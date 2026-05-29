import prisma from "../db.server";
import {
  DEFAULT_SINGLE_METAFIELD_MAX_BYTES,
  PUBLISHED_CONFIG_SCHEMA_VERSION,
  type BuiltPublishedConfigSnapshot,
  type PublishedConfigSnapshotPayload,
} from "../types/published-config";
import { getCheckoutRuleSettings } from "./checkout-settings.server";

const parseList = (value: string) => JSON.parse(value) as string[];

const parsePincodeList = (value: string) => {
  const parsed = parseList(value);
  return Array.from(
    new Set(
      parsed.flatMap((item) => {
        const text = String(item ?? "").trim();
        if (!text) return [];
        const matches = text.match(/[1-9]\d{5}/g);
        return matches?.length ? matches : [text];
      }),
    ),
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

  const [
    productRestrictionRules,
    shippingMethodMappings,
    paymentMethodMappings,
    shippingHideRules,
    shippingRenameRules,
    paymentHideRules,
    cutoffSettings,
    checkoutSettings,
  ] = await Promise.all([
    prisma.productRestrictionRule.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.shippingMethodMapping.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.paymentMethodMapping.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.shippingHideRule.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.shippingRenameRule.findMany({
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
      records: records.map((record) => ({
        st: record.state,
        di: record.district,
        pc: record.pincode,
        ln: record.locationName,
        ag: record.areaGroup,
        da: record.deliveryAvailability,
        sd: record.sameDayDeliveryRule,
        nd: record.nextDayDeliveryRule,
        pa: record.productAvailabilityRule,
        rm: record.remarks,
        ch: record.chargesPricingText,
        usd: record.updatedSameDayRule,
        und: record.updatedNextDayRule,
      })),
    },
    settings: checkoutSettings,
    rules: {
      productRestrictions: productRestrictionRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        productTags: parseList(rule.productTagsJson),
        pincodes: parsePincodeList(rule.pincodesJson),
        areaGroups: parseList(rule.areaGroupsJson),
        deliveryAvailabilityText: rule.deliveryAvailabilityText,
        validationMessage: rule.validationMessage,
        notes: rule.notes,
      })),
      shippingMethodMappings: shippingMethodMappings.map((mapping) => ({
        id: mapping.id,
        name: mapping.name,
        priority: mapping.priority,
        matchType: mapping.matchType === "contains" ? "contains" : "exact",
        matchValue: mapping.matchValue,
        notes: mapping.notes,
      })),
      paymentMethodMappings: paymentMethodMappings.map((mapping) => ({
        id: mapping.id,
        name: mapping.name,
        priority: mapping.priority,
        matchType: mapping.matchType === "contains" ? "contains" : "exact",
        matchValue: mapping.matchValue,
        notes: mapping.notes,
      })),
      shippingHideRules: shippingHideRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        shippingMethodMappingId: rule.shippingMethodMappingId,
        selectedShippingMethods: parseList(rule.selectedShippingMethodsJson) as unknown as import("../types/rule-config").PublishedSelectedShippingMethod[],
        cutoffRuleSettingId: rule.cutoffRuleSettingId,
        productTags: parseList(rule.productTagsJson),
        pincodes: parsePincodeList(rule.pincodesJson),
        areaGroups: parseList(rule.areaGroupsJson),
        deliveryAvailabilityText: rule.deliveryAvailabilityText,
        notes: rule.notes,
      })),
      shippingRenameRules: shippingRenameRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        shippingMethodMappingId: rule.shippingMethodMappingId,
        selectedShippingMethods: parseList(rule.selectedShippingMethodsJson) as unknown as import("../types/rule-config").PublishedSelectedRenameMethod[],
        cutoffRuleSettingId: rule.cutoffRuleSettingId,
        newLabel: rule.newLabel,
        productTags: parseList(rule.productTagsJson),
        pincodes: parsePincodeList(rule.pincodesJson),
        areaGroups: parseList(rule.areaGroupsJson),
        deliveryAvailabilityText: rule.deliveryAvailabilityText,
        notes: rule.notes,
      })),
      paymentHideRules: paymentHideRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        paymentMethodMappingId: rule.paymentMethodMappingId,
        selectedPaymentMethods: parseList(rule.selectedPaymentMethodsJson) as unknown as import("../types/rule-config").PublishedSelectedPaymentMethod[],
        cutoffRuleSettingId: rule.cutoffRuleSettingId,
        selectedShippingContains: rule.selectedShippingContains,
        productTags: parseList(rule.productTagsJson),
        pincodes: parsePincodeList(rule.pincodesJson),
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
