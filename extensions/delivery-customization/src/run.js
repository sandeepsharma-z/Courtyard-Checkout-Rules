// @ts-check

const NO_CHANGES = { operations: [] };
const PUBLISHED_CONFIG_MAX_CHARS = 100000;
const SUPPORTED_SCHEMA_VERSION = 2;
const SUPPORTED_CONFIG_KIND = "courtyard_checkout_rules.pincode_config";

/**
 * Applies published shipping hide / show (allowlist) / rename rules at checkout.
 * Lean single-pass implementation: keeps the function fast and its output small.
 *
 * @param {unknown} input
 * @returns {{ operations: Array<{ hide: { deliveryOptionHandle: string } } | { rename: { deliveryOptionHandle: string, title: string } }> }}
 */
export function run(input) {
  const config = parsePublishedConfig(input);
  if (!config) {
    return NO_CHANGES;
  }

  const operations = [];
  const deliveryGroups = Array.isArray(input?.cart?.deliveryGroups)
    ? input.cart.deliveryGroups
    : [];
  // Shop-local time ("HH:MM") written by the Courtyard time embed block.
  // Reads the current attribute key and the legacy underscore key, so it works
  // whether the storefront serves the new or the previously deployed embed.
  const cartTime =
    normalize(input?.cart?.timeAttr?.value) ||
    normalize(input?.cart?.timeAttrLegacy?.value);

  for (const group of deliveryGroups) {
    const pincode = normalize(group?.deliveryAddress?.zip);
    const pincodeRecord = findPincodeRecord(config, pincode);
    const options = Array.isArray(group?.deliveryOptions)
      ? group.deliveryOptions
      : [];

    // Unserviceable / blocked pincode: hide every delivery option so the
    // checkout offers no shipping (mirrors the product-validation block, where
    // the location shows a "not available" error).
    if (pincodeBlocked(config, pincode, pincodeRecord, cartTime)) {
      for (const option of options) {
        const handle = normalize(option?.handle);
        if (handle) operations.push({ hide: { deliveryOptionHandle: handle } });
      }
      continue;
    }

    const hideRules = Array.isArray(config.rules?.shippingHideRules)
      ? config.rules.shippingHideRules
      : [];
    // Build the allowlist (show) and blocklist (hide) matchers for this pincode.
    const showMatchers = [];
    const hideMatchers = [];
    let hasAllowlist = false;
    for (const rule of hideRules) {
      if (!ruleMatchesContext(rule, pincode, pincodeRecord, config, cartTime))
        continue;
      const methods = Array.isArray(rule.selectedShippingMethods)
        ? rule.selectedShippingMethods
        : [];
      if (normalize(rule.methodMatchMode) === "show") {
        hasAllowlist = true;
        for (const m of methods) showMatchers.push(m);
      } else {
        for (const m of methods) hideMatchers.push(m);
      }
    }

    for (const option of options) {
      const handle = normalize(option?.handle);
      if (!handle) continue;

      // Allowlist: hide anything that is not explicitly allowed.
      if (hasAllowlist && !methodMatches(showMatchers, option)) {
        operations.push({ hide: { deliveryOptionHandle: handle } });
        continue;
      }

      // Blocklist: hide explicitly blocked methods.
      if (hideMatchers.length > 0 && methodMatches(hideMatchers, option)) {
        operations.push({ hide: { deliveryOptionHandle: handle } });
        continue;
      }
    }
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parsePublishedConfig(input) {
  const value = input?.shop?.metafield?.value;
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.length > PUBLISHED_CONFIG_MAX_CHARS) return null;

  try {
    const parsed = JSON.parse(value);
    if (
      parsed?.v !== SUPPORTED_SCHEMA_VERSION ||
      parsed?.kind !== SUPPORTED_CONFIG_KIND ||
      !Array.isArray(parsed?.pincodeData?.records)
    ) {
      return null;
    }
    const rules = parsed.rules ?? {};
    parsed.rules = {
      ...rules,
      shippingHideRules: Array.isArray(rules.shippingHideRules)
        ? rules.shippingHideRules
        : [],
      shippingRenameRules: Array.isArray(rules.shippingRenameRules)
        ? rules.shippingRenameRules
        : [],
    };
    return parsed;
  } catch {
    return null;
  }
}

function findPincodeRecord(config, pincode) {
  if (!pincode) return null;
  const records = Array.isArray(config?.pincodeData?.records)
    ? config.pincodeData.records
    : [];
  return records.find((record) => normalize(record.pc) === pincode) ?? null;
}

/**
 * True when the customer's pincode is blocked / unserviceable, so no shipping
 * should be offered. Mirrors the checkout-validation block exactly, so shipping
 * is hidden precisely when the validation function shows a "not available"
 * error:
 *   1. Unknown pincode when "block unknown pincodes" is enabled.
 *   2. A product restriction (carrying a message) whose location conditions
 *      match. Product tags are NOT readable by Shopify Functions, so — exactly
 *      like the validation function — they do not narrow the match.
 */
function pincodeBlocked(config, pincode, pincodeRecord, cartTime) {
  if (!pincode) return false;

  const settings = config?.settings ?? {};
  if (
    settings.blockUnknownPincode === true &&
    !pincodeRecord &&
    normalize(settings.unknownPincodeMessage)
  ) {
    return true;
  }

  const restrictions = Array.isArray(config?.rules?.productRestrictions)
    ? config.rules.productRestrictions
    : [];
  for (const rule of restrictions) {
    if (!normalize(rule.validationMessage)) continue;
    if (!cutoffAllows(rule, config, cartTime)) continue;
    if (!restrictionLocationMatches(rule, pincode, pincodeRecord)) continue;
    return true;
  }
  return false;
}

/**
 * Location-only match for a product restriction, mirroring the validation
 * function's pincodeMatchesRule (explicit pincodes / area groups / delivery
 * availability text). Product tags are intentionally not considered here.
 */
function restrictionLocationMatches(rule, pincode, pincodeRecord) {
  const rulePincodes = expandPincodeValues(rule.pincodes);
  if (rulePincodes.length > 0 && !rulePincodes.includes(pincode)) return false;

  const ruleAreaGroups = Array.isArray(rule.areaGroups) ? rule.areaGroups : [];
  if (ruleAreaGroups.length > 0) {
    if (!pincodeRecord) return false;
    if (!ruleAreaGroups.map(normalize).includes(normalize(pincodeRecord.ag))) {
      return false;
    }
  }

  const ruleDeliveryText = normalize(rule.deliveryAvailabilityText);
  if (ruleDeliveryText) {
    if (!pincodeRecord) return false;
    if (normalize(pincodeRecord.da) !== ruleDeliveryText) return false;
  }

  return true;
}

/**
 * True when a rule's pincode / area / delivery-text / cutoff conditions match
 * this group. Rules with product-tag conditions are still skipped, since the
 * delivery function cannot evaluate them reliably.
 */
function ruleMatchesContext(rule, pincode, pincodeRecord, config, cartTime) {
  if (!cutoffAllows(rule, config, cartTime)) return false;
  if (Array.isArray(rule.productTags) && rule.productTags.length > 0) return false;
  if (!pincodeMatches(rule, pincode)) return false;
  if (!areaGroupMatches(rule, pincodeRecord)) return false;
  if (!deliveryAvailabilityMatches(rule, pincodeRecord)) return false;
  return true;
}

/**
 * Evaluates a rule's time-of-day (cutoff) condition.
 *
 * Rules without a cutoff always pass (unchanged behavior). Rules with a cutoff
 * fail safe: if the setting is missing or the cart time is absent/invalid, the
 * rule is treated as NOT applying (returns false), so we never hide/show based
 * on an unknown time.
 */
function cutoffAllows(rule, config, cartTime) {
  const cutoffId = normalize(rule?.cutoffRuleSettingId);
  if (!cutoffId) return true;

  const settings = Array.isArray(config?.rules?.cutoffSettings)
    ? config.rules.cutoffSettings
    : [];
  const setting = settings.find((entry) => normalize(entry?.id) === cutoffId);
  if (!setting) return false;

  const cartMinutes = parseTimeToMinutes(cartTime);
  if (cartMinutes === null) return false;

  const cutoffMinutes = parseTimeToMinutes(setting.timeValue);
  if (cutoffMinutes === null) return false;

  if (normalize(setting.matchMode) === "after") {
    return cartMinutes >= cutoffMinutes;
  }
  // Default (and explicit "before"): rule applies before the cutoff time.
  return cartMinutes < cutoffMinutes;
}

/**
 * Parses "HH:MM" (24h) or "hh:MM AM/PM" into minutes-since-midnight.
 * Returns null when the value is missing or unparseable.
 */
function parseTimeToMinutes(value) {
  const text = normalize(value);
  if (!text) return null;

  const meridiem = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(text);
  if (meridiem) {
    let hours = Number(meridiem[1]);
    const minutes = Number(meridiem[2]);
    const isPm = meridiem[3].toLowerCase() === "pm";
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (hours === 12) hours = 0;
    if (isPm) hours += 12;
    return hours * 60 + minutes;
  }

  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    const minutes = Number(twentyFour[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  return null;
}

/** True when any matcher entry matches the delivery option. */
function methodMatches(matchers, option) {
  if (!Array.isArray(matchers) || matchers.length === 0) return false;
  return matchers.some((entry) => entryMatchesOption(entry, option));
}

function entryMatchesOption(entry, option) {
  const value = normalize(entry?.value ?? entry?.matchValue);
  if (!value) return false;
  const candidates = [
    normalize(option?.title),
    normalize(option?.code),
    normalize(option?.handle),
  ].filter(Boolean);
  const operator = normalize(entry?.operator);
  switch (operator) {
    case "contains":
      return candidates.some((c) => c.includes(value));
    case "starts_with":
    case "startswith":
      return candidates.some((c) => c.startsWith(value));
    case "ends_with":
    case "endswith":
      return candidates.some((c) => c.endsWith(value));
    default:
      return candidates.some((c) => c === value);
  }
}

function pincodeMatches(rule, pincode) {
  const rulePincodes = expandPincodeValues(rule.pincodes);
  return rulePincodes.length === 0 || rulePincodes.includes(pincode);
}

function expandPincodeValues(value) {
  const rawValues = Array.isArray(value) ? value : [];
  return [
    ...new Set(
      rawValues.flatMap((item) => {
        const text = normalize(item);
        if (!text) return [];
        return text.match(/[1-9]\d{5}/g) ?? [];
      }),
    ),
  ];
}

function areaGroupMatches(rule, pincodeRecord) {
  if (!Array.isArray(rule.areaGroups) || rule.areaGroups.length === 0) return true;
  if (!pincodeRecord) return false;
  return rule.areaGroups.map(normalize).includes(normalize(pincodeRecord.ag));
}

function deliveryAvailabilityMatches(rule, pincodeRecord) {
  const text = normalize(rule.deliveryAvailabilityText);
  if (!text) return true;
  if (!pincodeRecord) return false;
  return normalize(pincodeRecord.da) === text;
}

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}
