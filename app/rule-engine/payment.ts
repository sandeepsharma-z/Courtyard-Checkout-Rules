import type { PaymentHidePreview, RuleEngineContext } from "./types";

export function evaluatePaymentHide({
  config,
  inputs,
  pincode,
}: RuleEngineContext & {
  pincode: { input: string; record: { ag: string; da: string } | null };
}): PaymentHidePreview {
  const mappings = config.rules?.paymentMethodMappings ?? [];
  const rules = config.rules?.paymentHideRules ?? [];
  const matchedRules = rules.filter((rule) => {
    const mapping = mappings.find(
      (item) => item.id === rule.paymentMethodMappingId,
    );
    const mappingMatches = mapping
      ? mapping.matchType === "contains"
        ? inputs.selectedPaymentMethod.includes(mapping.matchValue)
        : inputs.selectedPaymentMethod === mapping.matchValue
      : false;
    const shippingMatches =
      !rule.selectedShippingContains ||
      inputs.selectedShippingMethod.includes(rule.selectedShippingContains);
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
      shippingMatches &&
      tagMatches &&
      pincodeMatches &&
      areaMatches &&
      deliveryMatches
    );
  });

  return {
    status: matchedRules.length > 0 ? "matched" : "not_configured",
    selectedPaymentMethod: inputs.selectedPaymentMethod,
    hiddenPaymentMethods: matchedRules
      .map(
        (rule) =>
          mappings.find((item) => item.id === rule.paymentMethodMappingId)
            ?.name ?? "",
      )
      .filter(Boolean),
    matchedRules,
    notes: [
      matchedRules.length > 0
        ? "Published payment hide rules matched this simulation."
        : "No published payment hide rule matched this simulation.",
      "No live payment method will be hidden in this phase.",
    ],
  };
}
