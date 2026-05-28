// @ts-check

const NO_OPERATIONS = { operations: [] };
const PUBLISHED_CONFIG_MAX_CHARS = 100000;
const SUPPORTED_SCHEMA_VERSION = 2;
const SUPPORTED_CONFIG_KIND = "courtyard_checkout_rules.pincode_config";

/**
 * Blocks checkout when the customer's pincode matches a product restriction rule.
 *
 * @param {unknown} input
 * @returns {{ operations: Array<{ validationAdd: { errors: Array<{ message: string, target: string }> } }> }}
 */
export function run(input) {
  const config = parsePublishedConfig(input);

  if (!config) {
    return NO_OPERATIONS;
  }

  const restrictions = Array.isArray(config.rules?.productRestrictions)
    ? config.rules.productRestrictions
    : [];

  if (restrictions.length === 0) {
    return NO_OPERATIONS;
  }

  const deliveryGroups = Array.isArray(input?.cart?.deliveryGroups)
    ? input.cart.deliveryGroups
    : [];

  const cartTags = getCartProductTags(input);
  const errors = [];

  for (const group of deliveryGroups) {
    const pincode = trim(group?.deliveryAddress?.zip);
    if (!pincode) continue;

    const pincodeRecord = findPincodeRecord(config, pincode);

    for (const rule of sortByPriority(restrictions)) {
      if (
        pincodeMatchesRule(rule, pincode, pincodeRecord) &&
        productTagsMatchRule(rule, cartTags)
      ) {
        const message = trim(rule.validationMessage);
        if (!message) continue;
        errors.push({
          message,
          target: "$.cart.deliveryGroups[0].deliveryAddress.zip",
        });
        break;
      }
    }
  }

  return errors.length > 0
    ? { operations: [{ validationAdd: { errors } }] }
    : NO_OPERATIONS;
}

// Helpers

function parsePublishedConfig(input) {
  const value = input?.shop?.metafield?.value;

  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > PUBLISHED_CONFIG_MAX_CHARS
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed?.v !== SUPPORTED_SCHEMA_VERSION ||
      parsed?.kind !== SUPPORTED_CONFIG_KIND ||
      !Array.isArray(parsed?.pincodeData?.records)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getCartProductTags(input) {
  const tags = new Set();
  const lines = Array.isArray(input?.cart?.lines) ? input.cart.lines : [];
  for (const line of lines) {
    const productTags = line?.merchandise?.product?.tags;
    if (Array.isArray(productTags)) {
      for (const tag of productTags) {
        tags.add(trim(tag));
      }
    }
  }
  return tags;
}

function findPincodeRecord(config, pincode) {
  return (
    config.pincodeData.records.find((r) => trim(r.pc) === pincode) ?? null
  );
}

function pincodeMatchesRule(rule, pincode, pincodeRecord) {
  const rulePincodes = expandPincodeValues(rule.pincodes);
  const ruleAreaGroups = Array.isArray(rule.areaGroups) ? rule.areaGroups : [];
  const ruleDeliveryText = trim(rule.deliveryAvailabilityText);

  // If explicit pincodes listed, must be in list
  if (rulePincodes.length > 0 && !rulePincodes.includes(pincode)) {
    return false;
  }

  // If area groups listed, pincode record must match one
  if (ruleAreaGroups.length > 0) {
    if (!pincodeRecord) return false;
    if (!ruleAreaGroups.map(trim).includes(trim(pincodeRecord.ag))) return false;
  }

  // If delivery availability text set, pincode record must match
  if (ruleDeliveryText) {
    if (!pincodeRecord) return false;
    if (trim(pincodeRecord.da) !== ruleDeliveryText) return false;
  }

  return true;
}

function expandPincodeValues(value) {
  const rawValues = Array.isArray(value) ? value : [];
  return [
    ...new Set(
      rawValues.flatMap((item) => {
        const text = trim(item);
        if (!text) return [];
        return text.match(/[1-9]\d{5}/g) ?? [];
      }),
    ),
  ];
}

function productTagsMatchRule(rule, cartTags) {
  const ruleTags = Array.isArray(rule.productTags) ? rule.productTags : [];
  if (ruleTags.length === 0) return true;
  if (cartTags.size === 0) return true;
  return ruleTags.map(trim).some((tag) => cartTags.has(tag));
}

function sortByPriority(items) {
  return [...items].sort(
    (a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100),
  );
}

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}
