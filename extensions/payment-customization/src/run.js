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
  const selectedShippingTitles = [];
  for (const group of deliveryGroups) {
    const zip = normalize(group?.deliveryAddress?.zip);
    if (zip && !pincode) {
      pincode = zip;
    }
    const title = normalize(group?.selectedDeliveryOption?.title);
    if (title) selectedShippingTitles.push(title);
  }
  const pincodeRecord = findPincodeRecord(config, pincode);

  // Collect payment-method matchers from every rule that matches this context.
  const matchers = [];
  for (const rule of paymentHideRules) {
    if (!ruleMatchesContext(rule, pincode, pincodeRecord, selectedShippingTitles))
      continue;
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
 * True when a rule's conditions match this checkout context. Rules with cutoff
 * time or product-tag conditions are skipped, since the payment function cannot
 * evaluate them reliably.
 *
 * Supports:
 *   - selectedShippingContains: rule applies only when a selected delivery
 *     option title contains the configured text (e.g., "Same Day Delivery").
 *   - pincode matching with "*"/"?" wildcards and an optional "not_has" mode
 *     (hide when the zip is NOT in the listed patterns).
 */
function ruleMatchesContext(rule, pincode, pincodeRecord, selectedShippingTitles) {
  if (normalize(rule.cutoffRuleSettingId)) return false;
  if (Array.isArray(rule.productTags) && rule.productTags.length > 0) return false;
  if (!shippingMatches(rule, selectedShippingTitles)) return false;
  if (!pincodeMatches(rule, pincode)) return false;
  if (!areaGroupMatches(rule, pincodeRecord)) return false;
  if (!deliveryAvailabilityMatches(rule, pincodeRecord)) return false;
  return true;
}

/** True when the rule has no shipping condition, or a selected option matches. */
function shippingMatches(rule, selectedShippingTitles) {
  const needle = normalize(rule.selectedShippingContains).toLowerCase();
  if (!needle) return true;
  const titles = Array.isArray(selectedShippingTitles)
    ? selectedShippingTitles
    : [];
  return titles.some((title) => normalize(title).toLowerCase().includes(needle));
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

/**
 * Pincode condition with "*"/"?" wildcard patterns and an optional negation
 * mode. "has" (default): rule applies when the zip matches a pattern. "not_has":
 * rule applies when the zip matches none of them (e.g., "hide COD outside the
 * 11x, 12x, 20x zones"). When patterns exist but the zip is unknown, the rule
 * does not apply (fail safe — never hide a payment method on an unknown zip).
 */
function pincodeMatches(rule, pincode) {
  const patterns = expandZipPatterns(rule.pincodes);
  if (patterns.length === 0) return true;
  if (!pincode) return false;

  const matchesAny = patterns.some((pattern) =>
    zipMatchesPattern(pincode, pattern),
  );
  return normalize(rule.pincodeMatchMode) === "not_has" ? !matchesAny : matchesAny;
}

function expandZipPatterns(value) {
  const rawValues = Array.isArray(value) ? value : [];
  return rawValues.map(normalize).filter(Boolean);
}

/** Matches a zip against a pattern supporting "*" (any run) and "?" (one char). */
function zipMatchesPattern(zip, pattern) {
  if (!zip || !pattern) return false;
  if (pattern.indexOf("*") === -1 && pattern.indexOf("?") === -1) {
    return zip === pattern;
  }
  let regex = "";
  for (const ch of pattern) {
    if (ch === "*") regex += ".*";
    else if (ch === "?") regex += ".";
    else regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  try {
    return new RegExp("^" + regex + "$").test(zip);
  } catch {
    return false;
  }
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
