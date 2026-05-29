// @ts-check

const NO_CHANGES = { operations: [] };
const PUBLISHED_CONFIG_MAX_CHARS = 100000;
const SUPPORTED_SCHEMA_VERSION = 2;
const SUPPORTED_CONFIG_KIND = "courtyard_checkout_rules.pincode_config";

/**
 * Hides payment methods at checkout based on published payment-hide rules.
 * Output is PURE HIDE operations only — never mixes hide with other operation
 * types, which Shopify has previously discarded.
 *
 * @param {unknown} input
 * @returns {{ operations: Array<{ hide: { paymentMethodId: string } }> }}
 */
export function run(input) {
  const config = parsePublishedConfig(input);
  if (!config) {
    return NO_CHANGES;
  }

  const paymentHideRules = Array.isArray(config.rules?.paymentHideRules)
    ? config.rules.paymentHideRules
    : [];
  if (paymentHideRules.length === 0) {
    return NO_CHANGES;
  }

  // Pincode comes from the first delivery group that carries a zip.
  const deliveryGroups = Array.isArray(input?.cart?.deliveryGroups)
    ? input.cart.deliveryGroups
    : [];
  let pincode = "";
  for (const group of deliveryGroups) {
    const zip = normalize(group?.deliveryAddress?.zip);
    if (zip) {
      pincode = zip;
      break;
    }
  }
  const pincodeRecord = findPincodeRecord(config, pincode);

  // Collect payment-method matchers from every rule that matches this context.
  const matchers = [];
  for (const rule of paymentHideRules) {
    if (!ruleMatchesContext(rule, pincode, pincodeRecord)) continue;
    const methods = Array.isArray(rule.selectedPaymentMethods)
      ? rule.selectedPaymentMethods
      : [];
    for (const method of methods) matchers.push(method);
  }

  if (matchers.length === 0) {
    return NO_CHANGES;
  }

  const paymentMethods = Array.isArray(input?.paymentMethods)
    ? input.paymentMethods
    : [];
  const operations = [];
  for (const node of paymentMethods) {
    const id = node?.id;
    if (typeof id !== "string" || id.length === 0) continue;
    if (matchers.some((entry) => entryMatchesName(entry, node?.name))) {
      operations.push({ hide: { paymentMethodId: id } });
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
      paymentHideRules: Array.isArray(rules.paymentHideRules)
        ? rules.paymentHideRules
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
 * True when a rule's pincode / area / delivery-text conditions match.
 * Rules with unsupported conditions (cutoff time, product tags) are skipped,
 * since the payment function cannot evaluate them reliably.
 *
 * NOTE: `selectedShippingContains` is intentionally IGNORED here. The payment
 * customization input does not expose the buyer's selected shipping method, so
 * we treat such rules as always-applicable rather than letting the condition
 * block matching.
 */
function ruleMatchesContext(rule, pincode, pincodeRecord) {
  if (normalize(rule.cutoffRuleSettingId)) return false;
  if (Array.isArray(rule.productTags) && rule.productTags.length > 0) return false;
  if (!pincodeMatches(rule, pincode)) return false;
  if (!areaGroupMatches(rule, pincodeRecord)) return false;
  if (!deliveryAvailabilityMatches(rule, pincodeRecord)) return false;
  return true;
}

/** True when a matcher entry matches the payment method name. */
function entryMatchesName(entry, name) {
  const value = normalize(entry?.value ?? entry?.matchValue);
  if (!value) return false;
  const candidate = normalize(name);
  if (!candidate) return false;
  const operator = normalize(entry?.operator);
  switch (operator) {
    case "contains":
      return candidate.includes(value);
    case "starts_with":
    case "startswith":
      return candidate.startsWith(value);
    case "ends_with":
    case "endswith":
      return candidate.endsWith(value);
    default:
      return candidate === value;
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
