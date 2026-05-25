import type { ProductRestrictionPreview, RuleEngineContext } from "./types";

export function evaluateProductRestrictions({
  config,
  inputs,
  pincode,
}: RuleEngineContext & {
  pincode: { input: string; record: { ag: string; da: string; pa: string; pc: string } | null };
}): ProductRestrictionPreview {
  const rules = config.rules?.productRestrictions ?? [];
  const matchedRules = rules.filter((rule) => {
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

    return tagMatches && pincodeMatches && areaMatches && deliveryMatches;
  });

  return {
    status: matchedRules.length > 0 ? "matched" : "preview_only",
    inputTags: inputs.productTags,
    productAvailabilityRule: pincode.record?.pa ?? "",
    matchedRules,
    validationMessages: matchedRules
      .map((rule) => rule.validationMessage)
      .filter(Boolean),
    notes: [
      matchedRules.length > 0
        ? "Published product restriction rules matched this simulation."
        : "No published product restriction rule matched this simulation.",
      "Product availability text from the matched pincode record is shown as imported/admin-configured data.",
      "No live checkout validation block will occur in this phase.",
    ],
  };
}
