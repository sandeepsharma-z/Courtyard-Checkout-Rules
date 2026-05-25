import type { PaymentHidePreview, RuleEngineContext } from "./types";

export function evaluatePaymentHide({
  inputs,
}: RuleEngineContext): PaymentHidePreview {
  return {
    status: "not_configured",
    selectedPaymentMethod: inputs.selectedPaymentMethod,
    hiddenPaymentMethods: [],
    notes: [
      "Selected payment method is accepted as a simulator input only.",
      "Published payment hide rule definitions are not available yet.",
      "No live payment method will be hidden in this phase.",
    ],
  };
}
