// @ts-check

const NO_CHANGES = { operations: [] };
const PUBLISHED_CONFIG_MAX_CHARS = 100000;
const SUPPORTED_SCHEMA_VERSION = 2;
const SUPPORTED_CONFIG_KIND = "courtyard_checkout_rules.pincode_config";

/**
 * Step 8b applies only published schema v2 shipping hide/rename rules.
 * Unsupported conditions fail closed by returning no operations.
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
    const deliveryOptions = Array.isArray(group?.deliveryOptions)
      ? group.deliveryOptions
      : [];
    const groupOperations = [];
    const cartTags = getCartProductTags(input);
    const productRestriction = findMatchingProductRestriction({
      rules: config.rules.productRestrictions,
      pincode,
      pincodeRecord,
      cartTags,
    });

    if (productRestriction) {
      // Checkout validation function handles blocking with the custom error message.
      // Do not hide shipping methods here — that would show a generic Shopify error
      // instead of the configured validation message.
      continue;
    }

    // Collect allowlist ("show") rules that match this group's context.
    // When present, any option not matching the allowlist is hidden.
    const allHideRules = Array.isArray(config.rules.shippingHideRules)
      ? config.rules.shippingHideRules
      : [];
    const showRules = sortByPriority(allHideRules).filter(
      (rule) =>
        normalize(rule.methodMatchMode) === "show" &&
        ruleMatchesContext(rule, pincode, pincodeRecord),
    );
    const hasAllowlist = showRules.length > 0;
    const allowMatchers = showRules.flatMap((rule) =>
      Array.isArray(rule.selectedShippingMethods)
        ? rule.selectedShippingMethods
        : [],
    );
    const hideModeRules = allHideRules.filter(
      (rule) => normalize(rule.methodMatchMode) !== "show",
    );

    for (const option of deliveryOptions) {
      const handle = normalize(option?.handle);

      if (!handle) {
        continue;
      }

      // 1. Allowlist mode: hide any option that is NOT in the allowlist.
      if (hasAllowlist && !selectedMethodsMatch(allowMatchers, option)) {
        groupOperations.push({ hide: { deliveryOptionHandle: handle } });
        continue;
      }

      const hideRule = findMatchingRule({
        rules: hideModeRules,
        mappings: config.rules.shippingMethodMappings,
        option,
        pincode,
        pincodeRecord,
      });

      if (hideRule) {
        groupOperations.push({ hide: { deliveryOptionHandle: handle } });
        continue;
      }

      const renameEntry = findRenameEntry({
        rules: config.rules.shippingRenameRules,
        mappings: config.rules.shippingMethodMappings,
        option,
        pincode,
        pincodeRecord,
      });

      if (renameEntry) {
        groupOperations.push({
          rename: {
            deliveryOptionHandle: handle,
            title: renameEntry.newLabel,
          },
        });
      }
    }

    if (groupOperations.length === 0) {
      groupOperations.push(
        ...buildManualDeliveryLabelOperations(config, pincodeRecord, deliveryOptions),
      );
    }

    operations.push(...groupOperations);
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}

function buildManualDeliveryLabelOperations(config, pincodeRecord, deliveryOptions) {
  if (config.settings?.autoRenameDeliveryOption !== true || !pincodeRecord) {
    return [];
  }

  const title = manualDeliveryTitle(config.settings, pincodeRecord);
  if (!title) {
    return [];
  }

  const firstOption = deliveryOptions.find((option) => normalize(option?.handle));
  if (!firstOption) {
    return [];
  }

  const firstHandle = normalize(firstOption.handle);
  const operations = [
    {
      rename: {
        deliveryOptionHandle: firstHandle,
        title,
      },
    },
  ];

  if (config.settings.hideOtherDeliveryOptions === true) {
    for (const option of deliveryOptions) {
      const handle = normalize(option?.handle);
      if (handle && handle !== firstHandle) {
        operations.push({ hide: { deliveryOptionHandle: handle } });
      }
    }
  }

  return operations;
}

function manualDeliveryTitle(settings, pincodeRecord) {
  const sameDay = normalize(pincodeRecord.usd) || normalize(pincodeRecord.sd);
  const nextDay = normalize(pincodeRecord.und) || normalize(pincodeRecord.nd);

  if (settings.deliveryLabelSource === "same_day") {
    return sameDay;
  }

  if (settings.deliveryLabelSource === "next_day") {
    return nextDay;
  }

  return sameDay || nextDay;
}

function parsePublishedConfig(input) {
  const value = input?.shop?.metafield?.value;

  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (value.length > PUBLISHED_CONFIG_MAX_CHARS) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed?.v !== SUPPORTED_SCHEMA_VERSION ||
      parsed?.kind !== SUPPORTED_CONFIG_KIND ||
      !Array.isArray(parsed?.pincodeData?.records) ||
      !isRuleSet(parsed?.rules)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isRuleSet(rules) {
  return (
    rules &&
    Array.isArray(rules.productRestrictions) &&
    Array.isArray(rules.shippingMethodMappings) &&
    Array.isArray(rules.shippingHideRules) &&
    Array.isArray(rules.shippingRenameRules)
  );
}

function getCartProductTags(input) {
  const tags = new Set();
  const lines = Array.isArray(input?.cart?.lines) ? input.cart.lines : [];
  for (const line of lines) {
    const productTags = line?.merchandise?.product?.tags;
    if (Array.isArray(productTags)) {
      for (const tag of productTags) {
        tags.add(normalize(tag));
      }
    }
  }
  return tags;
}

function findPincodeRecord(config, pincode) {
  if (!pincode) {
    return null;
  }

  return (
    config.pincodeData.records.find((record) => normalize(record.pc) === pincode) ??
    null
  );
}

function findMatchingRule({
  rules,
  mappings,
  option,
  pincode,
  pincodeRecord,
}) {
  return sortByPriority(rules).find((rule) => {
    if (hasUnsupportedShippingRuleConditions(rule)) {
      return false;
    }

    const methodMatched = selectedMethodsMatch(rule.selectedShippingMethods, option)
      || mappingMatches(
          mappings.find(
            (item) => normalize(item.id) === normalize(rule.shippingMethodMappingId),
          ),
          option,
        );

    return (
      methodMatched &&
      pincodeMatches(rule, pincode) &&
      areaGroupMatches(rule, pincodeRecord) &&
      deliveryAvailabilityMatches(rule, pincodeRecord)
    );
  });
}

/**
 * For rename rules: find the specific selectedShippingMethods entry that matches
 * this option, so we can use its per-row newLabel.
 * Falls back to rule.newLabel for legacy rules.
 */
function findRenameEntry({ rules, mappings, option, pincode, pincodeRecord }) {
  for (const rule of sortByPriority(rules)) {
    if (hasUnsupportedShippingRuleConditions(rule)) continue;
    if (!pincodeMatches(rule, pincode)) continue;
    if (!areaGroupMatches(rule, pincodeRecord)) continue;
    if (!deliveryAvailabilityMatches(rule, pincodeRecord)) continue;

    // New-style: per-row matchValue + newLabel in selectedShippingMethods
    if (Array.isArray(rule.selectedShippingMethods) && rule.selectedShippingMethods.length > 0) {
      const entry = rule.selectedShippingMethods.find((e) => {
        const matchValue = normalize(e.matchValue ?? e.value);
        if (!matchValue) return false;
        const candidates = [
          normalize(option?.title),
          normalize(option?.code),
          normalize(option?.handle),
        ].filter(Boolean);
        const op = normalize(e.operator);
        switch (op) {
          case "contains": return candidates.some((c) => c.includes(matchValue));
          case "starts_with":
          case "startswith": return candidates.some((c) => c.startsWith(matchValue));
          case "ends_with":
          case "endswith": return candidates.some((c) => c.endsWith(matchValue));
          default: return candidates.some((c) => c === matchValue);
        }
      });
      if (entry && normalize(entry.newLabel)) {
        return { newLabel: normalize(entry.newLabel) };
      }
    }

    // Legacy: rule.newLabel + mappingId matching
    const legacyMatch = mappingMatches(
      mappings.find((m) => normalize(m.id) === normalize(rule.shippingMethodMappingId)),
      option,
    );
    if (legacyMatch && normalize(rule.newLabel)) {
      return { newLabel: normalize(rule.newLabel) };
    }
  }
  return null;
}

/**
 * Check if a delivery option matches any entry in selectedShippingMethods.
 * Each entry has { operator, value } (for hide) or { operator, matchValue } (for rename).
 *
 * @param {Array<{operator: string, value?: string, matchValue?: string}>|undefined} selectedMethods
 * @param {object} option
 * @returns {boolean}
 */
function selectedMethodsMatch(selectedMethods, option) {
  if (!Array.isArray(selectedMethods) || selectedMethods.length === 0) {
    return false;
  }

  const candidates = [
    normalize(option?.title),
    normalize(option?.code),
    normalize(option?.handle),
  ].filter(Boolean);

  return selectedMethods.some((entry) => {
    const matchValue = normalize(entry.value ?? entry.matchValue);
    if (!matchValue) return false;

    const operator = normalize(entry.operator);

    switch (operator) {
      case "contains":
        return candidates.some((c) => c.includes(matchValue));
      case "starts_with":
      case "startswith":
        return candidates.some((c) => c.startsWith(matchValue));
      case "ends_with":
      case "endswith":
        return candidates.some((c) => c.endsWith(matchValue));
      default:
        // "is" or exact match
        return candidates.some((c) => c === matchValue);
    }
  });
}

/**
 * Whether a shipping hide rule matches the group context (pincode / area / delivery
 * text / supported conditions) — independent of any specific delivery option.
 * Used for allowlist ("show") rules which gate the whole group.
 */
function ruleMatchesContext(rule, pincode, pincodeRecord) {
  return (
    !hasUnsupportedShippingRuleConditions(rule) &&
    pincodeMatches(rule, pincode) &&
    areaGroupMatches(rule, pincodeRecord) &&
    deliveryAvailabilityMatches(rule, pincodeRecord)
  );
}

function hasUnsupportedShippingRuleConditions(rule) {
  return (
    normalize(rule.cutoffRuleSettingId) ||
    (Array.isArray(rule.productTags) && rule.productTags.length > 0)
  );
}

function findMatchingProductRestriction({
  rules,
  pincode,
  pincodeRecord,
  cartTags,
}) {
  if (!Array.isArray(rules)) {
    return null;
  }

  return (
    sortByPriority(rules).find(
      (rule) =>
        pincodeMatches(rule, pincode) &&
        areaGroupMatches(rule, pincodeRecord) &&
        deliveryAvailabilityMatches(rule, pincodeRecord) &&
        productTagsMatch(rule, cartTags),
    ) ?? null
  );
}

function mappingMatches(mapping, option) {
  if (!mapping) {
    return false;
  }

  const matchValue = normalize(mapping.matchValue);

  if (!matchValue) {
    return false;
  }

  const candidates = [
    normalize(option?.title),
    normalize(option?.code),
    normalize(option?.handle),
  ].filter(Boolean);

  if (mapping.matchType === "contains") {
    return candidates.some((candidate) => candidate.includes(matchValue));
  }

  return candidates.some((candidate) => candidate === matchValue);
}

function pincodeMatches(rule, pincode) {
  const rulePincodes = expandPincodeValues(rule.pincodes);
  return (
    rulePincodes.length === 0 ||
    rulePincodes.includes(pincode)
  );
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
  return (
    !Array.isArray(rule.areaGroups) ||
    rule.areaGroups.length === 0 ||
    (pincodeRecord
      ? rule.areaGroups.map(normalize).includes(normalize(pincodeRecord.ag))
      : false)
  );
}

function deliveryAvailabilityMatches(rule, pincodeRecord) {
  const deliveryAvailabilityText = normalize(rule.deliveryAvailabilityText);

  return (
    !deliveryAvailabilityText ||
    (pincodeRecord
      ? normalize(pincodeRecord.da) === deliveryAvailabilityText
      : false)
  );
}

function productTagsMatch(rule, cartTags) {
  const ruleTags = Array.isArray(rule.productTags) ? rule.productTags : [];
  if (ruleTags.length === 0) return true;
  if (cartTags.size === 0) return true;
  return ruleTags.map(normalize).some((tag) => cartTags.has(tag));
}

function sortByPriority(items) {
  return [...items].sort(
    (first, second) =>
      Number(first.priority ?? 100) - Number(second.priority ?? 100),
  );
}

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}
