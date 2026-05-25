import type { ProductRestrictionPreview, RuleEngineContext } from "./types";

export function evaluateProductRestrictions({
  inputs,
  pincode,
}: RuleEngineContext & {
  pincode: { record: { pa: string } | null };
}): ProductRestrictionPreview {
  return {
    status: "preview_only",
    inputTags: inputs.productTags,
    productAvailabilityRule: pincode.record?.pa ?? "",
    notes: [
      "Product tags are accepted as simulator inputs only.",
      "Published product tag restriction rule definitions are not available yet.",
      "Product availability text from the matched pincode record is shown as imported/admin-configured data.",
    ],
  };
}
