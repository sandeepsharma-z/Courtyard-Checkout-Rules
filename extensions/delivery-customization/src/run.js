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

  for (const group of deliveryGroups) {
    const pincode = normalize(group?.deliveryAddress?.zip);
    const pincodeRecord = findPincodeRecord(config, pincode);
    const options = Array.isArray(group?.deliveryOptions)
      ? group.deliveryOptions
      : [];

    const hideRules = Array.isArray(config.rules?.shippingHideRules)
      ? config.rules.shippingHideRules
      : [];
    // Build the allowlist (show) and blocklist (hide) matchers for this pincode.
    const showMatchers = [];
    const hideMatchers = [];
    let hasAllowlist = false;
    for (const rule of hideRules) {
      if (!ruleMatchesContext(rule, pincode, pincodeRecord)) continue;
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
 * True when a rule's pincode / area / delivery-text conditions match this group.
 * Rules with unsupported conditions (cutoff time, product tags) are skipped,
 * since the delivery function cannot evaluate them reliably.
 */
function ruleMatchesContext(rule, pincode, pincodeRecord) {
  if (normalize(rule.cutoffRuleSettingId)) return false;
  if (Array.isArray(rule.productTags) && rule.productTags.length > 0) return false;
  if (!pincodeMatches(rule, pincode)) return false;
  if (!areaGroupMatches(rule, pincodeRecord)) return false;
  if (!deliveryAvailabilityMatches(rule, pincodeRecord)) return false;
  return true;
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
