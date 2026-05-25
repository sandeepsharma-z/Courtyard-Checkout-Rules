import type {
  RuleEngineContext,
  ShippingHidePreview,
  ShippingRenamePreview,
} from "./types";

export function evaluateShippingHide({
  config,
  inputs,
  pincode,
}: RuleEngineContext & {
  pincode: { input: string; record: { ag: string; da: string } | null };
}): ShippingHidePreview {
  const mappings = config.rules?.shippingMethodMappings ?? [];
  const rules = config.rules?.shippingHideRules ?? [];
  const matchedRules = rules.filter((rule) => {
    const mapping = mappings.find(
      (item) => item.id === rule.shippingMethodMappingId,
    );
    const mappingMatches = mapping
      ? mapping.matchType === "contains"
        ? inputs.selectedShippingMethod.includes(mapping.matchValue)
        : inputs.selectedShippingMethod === mapping.matchValue
      : false;
    const tagMatches =
      rule.productTags.length === 0 ||
      rule.productTags.some((tag) => inputs.productTags.includes(tag));
    const pincodeMatches =
      rule.pincodes.length === 0 || rule.pincodes.includes(pincode.input);
    const areaMatches =
      rule.areaGroups.length === 0 ||
      (pincode.record ? rule.areaGroups.includes(pincode.record.ag) : false);
    const deliveryMatches =
      !rule.deliveryAvailabilityText ||
      (pincode.record
        ? pincode.record.da === rule.deliveryAvailabilityText
        : false);

    return (
      mappingMatches &&
      tagMatches &&
      pincodeMatches &&
      areaMatches &&
      deliveryMatches
    );
  });

  return {
    status: matchedRules.length > 0 ? "matched" : "not_configured",
    selectedShippingMethod: inputs.selectedShippingMethod,
    hiddenMethods: matchedRules
      .map(
        (rule) =>
          mappings.find((item) => item.id === rule.shippingMethodMappingId)
            ?.name ?? "",
      )
      .filter(Boolean),
    matchedRules,
    notes: [
      matchedRules.length > 0
        ? "Published shipping hide rules matched this simulation."
        : "No published shipping hide rule matched this simulation.",
      "No live shipping method will be hidden in this phase.",
    ],
  };
}

export function evaluateShippingRename({
  config,
  inputs,
  pincode,
  hiddenMethodMappingIds = [],
}: RuleEngineContext & {
  hiddenMethodMappingIds?: string[];
  pincode: { input: string; record: { ag: string; da: string } | null };
}): ShippingRenamePreview {
  const mappings = config.rules?.shippingMethodMappings ?? [];
  const rules = config.rules?.shippingRenameRules ?? [];
  const matchedRules = rules.filter((rule) => {
    if (hiddenMethodMappingIds.includes(rule.shippingMethodMappingId)) {
      return false;
    }

    const mapping = mappings.find(
      (item) => item.id === rule.shippingMethodMappingId,
    );
    const mappingMatches = mapping
      ? mapping.matchType === "contains"
        ? inputs.selectedShippingMethod.includes(mapping.matchValue)
        : inputs.selectedShippingMethod === mapping.matchValue
      : false;
    const tagMatches =
      rule.productTags.length === 0 ||
      rule.productTags.some((tag) => inputs.productTags.includes(tag));
    const pincodeMatches =
      rule.pincodes.length === 0 || rule.pincodes.includes(pincode.input);
    const areaMatches =
      rule.areaGroups.length === 0 ||
      (pincode.record ? rule.areaGroups.includes(pincode.record.ag) : false);
    const deliveryMatches =
      !rule.deliveryAvailabilityText ||
      (pincode.record
        ? pincode.record.da === rule.deliveryAvailabilityText
        : false);

    return (
      mappingMatches &&
      tagMatches &&
      pincodeMatches &&
      areaMatches &&
      deliveryMatches
    );
  });
  const winningRule = matchedRules[0];

  return {
    status: winningRule ? "matched" : "not_configured",
    selectedShippingMethod: inputs.selectedShippingMethod,
    renamedMethod: winningRule?.newLabel ?? "",
    matchedRules,
    notes: [
      winningRule
        ? "A published shipping rename rule matched this simulation."
        : "No published shipping rename rule matched this simulation.",
      "Shipping hide matches take priority over rename matches.",
      "No live shipping method will be renamed in this phase.",
    ],
  };
}
