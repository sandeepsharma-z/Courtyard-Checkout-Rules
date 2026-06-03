import prisma from "../db.server";
import {
  DEFAULT_SINGLE_METAFIELD_MAX_BYTES,
  PUBLISHED_CONFIG_SCHEMA_VERSION,
  type BuiltPublishedConfigSnapshot,
  type PublishedConfigSnapshotPayload,
} from "../types/published-config";
import {
  getCheckoutRuleSettings,
  type CheckoutRuleSettings,
} from "./checkout-settings.server";
import {
  getPincodeGroupMap,
  getReachTagZones,
} from "./pincode-group-storage.server";

const parseList = (value: string) => JSON.parse(value) as string[];

// Rules may reference reusable pincode groups (ids stored in conditionsJson).
// At publish time those group pincodes are merged into the rule's own pincode
// list, so the checkout Functions keep receiving plain pincode lists.
const parseGroupIds = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value || "{}") as { groupIds?: unknown };
    return Array.isArray(parsed?.groupIds)
      ? parsed.groupIds.map((g) => String(g)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

// Payment-hide rules store their pincode match mode ("has" | "not_has") inside
// the generic conditionsJson bag, so no schema column is needed.
const parsePincodeMatchMode = (value: string): "has" | "not_has" => {
  try {
    const parsed = JSON.parse(value || "{}") as { pincodeMatchMode?: string };
    return parsed?.pincodeMatchMode === "not_has" ? "not_has" : "has";
  } catch {
    return "has";
  }
};

// Product restrictions store their tag match mode ("has" | "not_has") in the
// same conditionsJson bag. "not_has" blocks when the cart is MISSING the tag —
// used to block a product in zones its reach tag does not cover.
const parseProductTagMode = (value: string): "has" | "not_has" => {
  try {
    const parsed = JSON.parse(value || "{}") as { productTagMode?: string };
    return parsed?.productTagMode === "not_has" ? "not_has" : "has";
  } catch {
    return "has";
  }
};

const parsePincodeList = (value: string) => {
  const parsed = parseList(value);
  return Array.from(
    new Set(
      parsed.flatMap((item) => {
        const text = String(item ?? "").trim();
        if (!text) return [];
        return text
          .split(/[,\r\n\s]+/)
          .map((token) => token.trim())
          .filter(Boolean);
      }),
    ),
  );
};

// Compress a resolved pincode list into numeric ranges to shrink the published
// metafield. Consecutive runs (n, n+1, …) collapse to "start-end"; the delivery
// Function expands these back to an inclusive numeric range. Lossless — only
// pincodes actually present are covered, so there is NO over-matching (unlike a
// "560*" prefix, which would also match unlisted 560xxx codes). Non-numeric
// entries (e.g. a user-typed "400*" prefix) pass through unchanged. Keeps the
// config small enough to stay under the Function's Wasm instruction limit even
// with the full all-India zone lists.
const compressPincodeList = (pincodes: string[]): string[] => {
  const seen = new Set<number>();
  const passthrough: string[] = [];
  for (const value of pincodes) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    if (/^\d+$/.test(text)) seen.add(Number(text));
    else passthrough.push(text);
  }
  const numeric = Array.from(seen).sort((a, b) => a - b);
  const out = [...passthrough];
  let i = 0;
  while (i < numeric.length) {
    let j = i;
    while (j + 1 < numeric.length && numeric[j + 1] === numeric[j] + 1) j++;
    out.push(j > i ? `${numeric[i]}-${numeric[j]}` : String(numeric[i]));
    i = j + 1;
  }
  return out;
};

// Shop-local (IST) minutes since midnight. Used to bake each cutoff's current
// active state into the published config so the delivery Function does not need
// the cart's clock (which express checkouts like "Buy it now" never carry).
const shopNowMinutesIST = (): number | null => {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
};

// Parses a cutoff "timeValue" ("HH:MM" 24h or "hh:MM AM/PM") into minutes.
const cutoffTimeToMinutes = (value: string): number | null => {
  const text = String(value ?? "").trim();
  const m12 = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(text);
  if (m12) {
    let hour = Number(m12[1]);
    const minute = Number(m12[2]);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (hour === 12) hour = 0;
    if (m12[3].toLowerCase() === "pm") hour += 12;
    return hour * 60 + minute;
  }
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (m24) {
    const hour = Number(m24[1]);
    const minute = Number(m24[2]);
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  }
  return null;
};

// True/false when the shop-local clock satisfies the cutoff; null when it can't
// be evaluated (the Function then falls back to the cart-time embed, if any).
const cutoffActiveNow = (
  timeValue: string,
  matchMode: string,
): boolean | null => {
  const now = shopNowMinutesIST();
  const cutoff = cutoffTimeToMinutes(timeValue);
  if (now === null || cutoff === null) return null;
  return String(matchMode).trim().toLowerCase() === "after"
    ? now >= cutoff
    : now < cutoff;
};

// IST calendar date ("YYYY-MM-DD") and day-of-week (0=Sun) for a given instant.
const istYmdAndDow = (date: Date): { ymd: string; dow: number } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dowMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    dow: dowMap[get("weekday")] ?? -1,
  };
};

const isHolidayOn = (
  date: Date,
  dates: Set<string>,
  sundayOff: boolean,
): boolean => {
  const { ymd, dow } = istYmdAndDow(date);
  if (sundayOff && dow === 0) return true;
  return dates.has(ymd);
};

// Whether the holiday banner should show: enabled AND (today OR tomorrow, in
// IST, is a holiday — a listed date or Sunday when the weekly-off is on).
// Computed at publish/cron time so the checkout-ui extension just reads a flag.
const computeHolidayBannerActive = (settings: CheckoutRuleSettings): boolean => {
  if (!settings.holidayBannerEnabled) return false;
  const dates = new Set(
    settings.holidayDates
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const sundayOff = settings.holidayWeeklyOffSunday;
  if (dates.size === 0 && !sundayOff) return false;
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  return (
    isHolidayOn(now, dates, sundayOff) ||
    isHolidayOn(tomorrow, dates, sundayOff)
  );
};

const byteSize = (value: string) => Buffer.byteLength(value, "utf8");

export function getSingleMetafieldMaxBytes() {
  const configuredValue = Number(process.env.PUBLISHED_CONFIG_MAX_BYTES);

  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return configuredValue;
  }

  return DEFAULT_SINGLE_METAFIELD_MAX_BYTES;
}

export async function buildPublishedConfigSnapshot(): Promise<BuiltPublishedConfigSnapshot | null> {
  const approvedBatch = await prisma.pincodeImportBatch.findFirst({
    where: { status: "approved" },
    orderBy: { approvedAt: "desc" },
  });

  const records = approvedBatch
    ? await prisma.pincodeRecord.findMany({
        where: { isActive: true, rowStatus: "valid" },
        orderBy: [{ pincode: "asc" }, { id: "asc" }],
      })
    : [];

  // Only fetch what the checkout Functions actually read. Shipping method
  // mappings, payment method mappings, and shipping rename rules are NOT used
  // by any Function (rename is not applied at checkout), so they are excluded
  // from the published metafield to keep it under Shopify's 10 KB
  // Function-input limit. They remain editable in the admin (read from the DB).
  const [
    productRestrictionRules,
    shippingHideRules,
    paymentHideRules,
    cutoffSettings,
    checkoutSettings,
  ] = await Promise.all([
    prisma.productRestrictionRule.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.shippingHideRule.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.paymentHideRule.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.cutoffRuleSetting.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    getCheckoutRuleSettings(),
  ]);

  // Resolve a rule's effective pincodes: its own list plus every pincode from
  // the groups it references. Deduped. Group pincodes may include prefixes
  // (e.g. "400*") which the delivery Function already understands.
  const groupMap = await getPincodeGroupMap();

  // Per-tag reach zones (tag -> serviceable pincodes), compressed to ranges so
  // the metafield stays small. The delivery Function blocks a tagged product at
  // any pincode outside its tags' zones.
  const reachZones = await getReachTagZones();
  const tagZones: Record<string, string[]> = {};
  for (const [tag, pcs] of Object.entries(reachZones)) {
    tagZones[tag] = compressPincodeList(pcs);
  }

  const resolvePincodes = (pincodesJson: string, conditionsJson: string) => {
    const own = parsePincodeList(pincodesJson);
    const groupIds = parseGroupIds(conditionsJson);
    if (groupIds.length === 0) return compressPincodeList(own);
    const merged = new Set(own);
    for (const gid of groupIds) {
      for (const pc of groupMap.get(gid) ?? []) merged.add(String(pc).trim());
    }
    return compressPincodeList(Array.from(merged).filter(Boolean));
  };

  const payload: PublishedConfigSnapshotPayload = {
    v: PUBLISHED_CONFIG_SCHEMA_VERSION,
    kind: "courtyard_checkout_rules.pincode_config",
    publishedAt: new Date().toISOString(),
    source: {
      type: approvedBatch ? "local_import_batch" : "manual_pincode_rules",
      batchId: approvedBatch?.id ?? "",
      filename: approvedBatch?.filename ?? "manual",
    },
    counts: {
      records: records.length,
    },
    pincodeData: {
      // Only the fields the checkout Functions actually read: pincode (pc),
      // area group (ag), delivery availability (da). The other descriptive CSV
      // columns are dropped here to keep the published metafield small enough
      // to stay within the size that Shopify includes in a Function's input
      // (a large metafield value is delivered to the Function as null).
      records: records.map((record) => ({
        pc: record.pincode,
        ag: record.areaGroup,
        da: record.deliveryAvailability,
      })),
    },
    tagZones,
    settings: {
      blockUnknownPincode: checkoutSettings.blockUnknownPincode,
      unknownPincodeMessage: checkoutSettings.unknownPincodeMessage,
      autoRenameDeliveryOption: checkoutSettings.autoRenameDeliveryOption,
      deliveryLabelSource: checkoutSettings.deliveryLabelSource,
      hideOtherDeliveryOptions: checkoutSettings.hideOtherDeliveryOptions,
      defaultShippingMethod: checkoutSettings.defaultShippingMethod,
      // Holiday banner flag baked here (today/tomorrow is a holiday). The raw
      // dates/weekly-off stay server-side; only the result + message ship.
      holidayBannerEnabled: checkoutSettings.holidayBannerEnabled,
      holidayBannerActive: computeHolidayBannerActive(checkoutSettings),
      holidayMessage: checkoutSettings.holidayMessage,
    },
    rules: {
      productRestrictions: productRestrictionRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        productTags: parseList(rule.productTagsJson),
        productTagMode: parseProductTagMode(rule.conditionsJson),
        pincodes: resolvePincodes(rule.pincodesJson, rule.conditionsJson),
        areaGroups: parseList(rule.areaGroupsJson),
        deliveryAvailabilityText: rule.deliveryAvailabilityText,
        validationMessage: rule.validationMessage,
        notes: rule.notes,
      })),
      // Not read by any checkout Function — omitted to keep the published
      // metafield under Shopify's 10 KB Function-input limit.
      shippingMethodMappings: [],
      paymentMethodMappings: [],
      shippingHideRules: shippingHideRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        shippingMethodMappingId: rule.shippingMethodMappingId,
        selectedShippingMethods: parseList(rule.selectedShippingMethodsJson) as unknown as import("../types/rule-config").PublishedSelectedShippingMethod[],
        methodMatchMode: rule.methodMatchMode,
        cutoffRuleSettingId: rule.cutoffRuleSettingId,
        productTags: parseList(rule.productTagsJson),
        pincodes: resolvePincodes(rule.pincodesJson, rule.conditionsJson),
        areaGroups: parseList(rule.areaGroupsJson),
        deliveryAvailabilityText: rule.deliveryAvailabilityText,
        notes: rule.notes,
      })),
      // Rename is not applied at checkout (Shopify discards hide+rename mixed
      // output) and is not read by any Function — omitted to save space.
      shippingRenameRules: [],
      paymentHideRules: paymentHideRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        paymentMethodMappingId: rule.paymentMethodMappingId,
        selectedPaymentMethods: parseList(rule.selectedPaymentMethodsJson) as unknown as import("../types/rule-config").PublishedSelectedPaymentMethod[],
        cutoffRuleSettingId: rule.cutoffRuleSettingId,
        selectedShippingContains: rule.selectedShippingContains,
        pincodeMatchMode: parsePincodeMatchMode(rule.conditionsJson),
        productTags: parseList(rule.productTagsJson),
        pincodes: resolvePincodes(rule.pincodesJson, rule.conditionsJson),
        areaGroups: parseList(rule.areaGroupsJson),
        deliveryAvailabilityText: rule.deliveryAvailabilityText,
        notes: rule.notes,
      })),
      cutoffSettings: cutoffSettings.map((setting) => ({
        id: setting.id,
        name: setting.name,
        priority: setting.priority,
        timeValue: setting.timeValue,
        timezone: setting.timezone,
        matchMode: setting.matchMode,
        // Baked here from the shop-local clock; the cron re-publishes twice a
        // day so this stays current. Lets the cutoff work on every checkout
        // path without a cart attribute.
        activeNow: cutoffActiveNow(setting.timeValue, setting.matchMode),
        notes: setting.notes,
      })),
    },
  };

  const payloadJson = JSON.stringify(payload);
  const payloadSizeBytes = byteSize(payloadJson);
  const maxBytes = getSingleMetafieldMaxBytes();

  return {
    payload,
    payloadJson,
    payloadSizeBytes,
    recordCount: records.length,
    sourceBatchId: approvedBatch?.id ?? null,
    sourceFilename: approvedBatch?.filename ?? "manual",
    maxBytes,
    isTooLarge: payloadSizeBytes > maxBytes,
  };
}

export async function createPublishHistoryRecord(input: {
  schemaVersion: number;
  status: string;
  shop: string;
  metafieldId?: string;
  sourceBatchId?: string | null;
  sourceFilename?: string;
  recordCount: number;
  payloadSizeBytes: number;
  payloadJson: string;
  message?: string;
  publishedAt?: Date | null;
}) {
  return prisma.publishedConfigSnapshot.create({
    data: {
      schemaVersion: input.schemaVersion,
      status: input.status,
      shop: input.shop,
      metafieldId: input.metafieldId ?? "",
      sourceBatchId: input.sourceBatchId ?? null,
      sourceFilename: input.sourceFilename ?? "",
      recordCount: input.recordCount,
      payloadSizeBytes: input.payloadSizeBytes,
      payloadJson: input.payloadJson,
      message: input.message ?? "",
      publishedAt: input.publishedAt ?? null,
    },
  });
}

export async function getPublishHistory() {
  return prisma.publishedConfigSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getPublishHistorySnapshot(id: string) {
  return prisma.publishedConfigSnapshot.findUnique({
    where: { id },
  });
}

export async function deletePublishHistorySnapshot(id: string) {
  return prisma.publishedConfigSnapshot.delete({
    where: { id },
  });
}
