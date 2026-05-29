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
    const renameRules = Array.isArray(config.rules?.shippingRenameRules)
      ? config.rules.shippingRenameRules
      : [];

    const matchingRenameRules = renameRules.filter((rule) =>
      ruleMatchesContext(rule, pincode, pincodeRecord),
    );
    const renameTargetsByHandle = new Map();
    const renameTargetTitles = new Set();
    for (const option of options) {
      const handle = normalize(option?.handle);
      const title = findRenameTitle(matchingRenameRules, option);
      if (handle && title) {
        renameTargetsByHandle.set(handle, title);
        renameTargetTitles.add(title);
      }
    }

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

    const hiddenHandles = new Set();

    for (const option of options) {
      const handle = normalize(option?.handle);
      if (!handle) continue;
      const renameTitle = renameTargetsByHandle.get(handle);

      // If Shopify already has a method with the admin-configured renamed label,
      // hide the source/default method instead of showing both.
      if (renameTitle && optionTitleExists(options, renameTitle, handle)) {
        hiddenHandles.add(handle);
        continue;
      }

      // When a pincode-specific rename rule matches, keep only the admin
      // configured delivery labels for that pincode. This removes the original
      // Shopify default rates that would otherwise appear beside local labels.
      if (
        renameTargetTitles.size > 0 &&
        !isRenameAllowedOption(option, handle, renameTargetsByHandle, renameTargetTitles)
      ) {
        hiddenHandles.add(handle);
        continue;
      }

      // Allowlist: hide anything that is not explicitly allowed.
      if (hasAllowlist && !allowlistMatches(showMatchers, option, renameTitle)) {
        hiddenHandles.add(handle);
        continue;
      }

      // Blocklist: hide explicitly blocked methods.
      if (hideMatchers.length > 0 && methodMatches(hideMatchers, option)) {
        hiddenHandles.add(handle);
        continue;
      }
    }

    for (const handle of hiddenHandles) {
      operations.push({ hide: { deliveryOptionHandle: handle } });
    }

    for (const option of options) {
      const handle = normalize(option?.handle);
      if (!handle || hiddenHandles.has(handle)) continue;

      const title = renameTargetsByHandle.get(handle);
      if (title && normalize(option?.title) !== title) {
        operations.push({
          rename: {
            deliveryOptionHandle: handle,
            title,
          },
        });
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

function allowlistMatches(matchers, option, renameTitle) {
  if (methodMatches(matchers, option)) return true;
  if (!renameTitle) return false;
  return methodMatches(matchers, {
    ...option,
    title: renameTitle,
    code: renameTitle,
  });
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
      // Admin-entered Shopify shipping labels are often copied partially from
      // the checkout UI. Treat "is" as exact-or-contained so a configured
      // value like "Same Day Delivery" can still match the full Shopify title.
      return candidates.some((c) => c === value || c.includes(value));
  }
}

function findRenameTitle(renameRules, option) {
  for (const rule of renameRules) {
    const methods = Array.isArray(rule.selectedShippingMethods)
      ? rule.selectedShippingMethods
      : [];
    for (const method of methods) {
      if (!entryMatchesOption(method, option)) continue;
      const title = normalize(method?.newLabel) || normalize(rule?.newLabel);
      if (title) return title;
    }
  }
  return "";
}

function isRenameAllowedOption(option, handle, renameTargetsByHandle, renameTargetTitles) {
  if (renameTargetsByHandle.has(handle)) return true;
  return [...renameTargetTitles].some((title) =>
    optionMatchesTitle(option, title),
  );
}

function optionTitleExists(options, title, exceptHandle) {
  const target = normalize(title);
  if (!target) return false;
  return options.some((option) => {
    const handle = normalize(option?.handle);
    if (!handle || handle === exceptHandle) return false;
    return optionMatchesTitle(option, target);
  });
}

function optionMatchesTitle(option, title) {
  const target = normalize(title);
  return (
    normalize(option?.title) === target ||
    normalize(option?.code) === target ||
    normalize(option?.handle) === target
  );
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
