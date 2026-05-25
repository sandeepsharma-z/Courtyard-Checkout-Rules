import type { PublishedConfigSnapshotPayload } from "../types/published-config";
import type { SimulatorInputs, SimulatorResult } from "../types/rule-simulator";
import { evaluateRulePreview } from "../rule-engine";

const splitTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export function simulatePublishedConfigLookup(
  config: PublishedConfigSnapshotPayload,
  inputs: SimulatorInputs,
): SimulatorResult {
  const pincode = inputs.pincode.trim();
  const parsedProductTags = splitTags(inputs.productTags);

  return {
    parsedProductTags,
    outcome: evaluateRulePreview(config, {
      pincode,
      cartTotal: inputs.cartTotal,
      productTags: parsedProductTags,
      selectedShippingMethod: inputs.selectedShippingMethod,
      selectedPaymentMethod: inputs.selectedPaymentMethod,
      currentTime: inputs.currentTime,
    }),
  };
}
