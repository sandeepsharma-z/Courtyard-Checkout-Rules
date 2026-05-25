import type { RuleEngineOutcome } from "../rule-engine/types";

export type SimulatorInputs = {
  pincode: string;
  cartTotal: string;
  productTags: string;
  selectedShippingMethod: string;
  selectedPaymentMethod: string;
  currentTime: string;
};

export type SimulatorResult = {
  parsedProductTags: string[];
  outcome: RuleEngineOutcome;
};
