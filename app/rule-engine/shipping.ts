import type {
  RuleEngineContext,
  ShippingHidePreview,
  ShippingRenamePreview,
} from "./types";

export function evaluateShippingHide({
  inputs,
}: RuleEngineContext): ShippingHidePreview {
  return {
    status: "not_configured",
    selectedShippingMethod: inputs.selectedShippingMethod,
    hiddenMethods: [],
    notes: [
      "Selected shipping method is accepted as a simulator input only.",
      "Published shipping hide rule definitions are not available yet.",
      "No live shipping method will be hidden in this phase.",
    ],
  };
}

export function evaluateShippingRename({
  inputs,
}: RuleEngineContext): ShippingRenamePreview {
  return {
    status: "not_configured",
    selectedShippingMethod: inputs.selectedShippingMethod,
    renamedMethod: "",
    notes: [
      "Selected shipping method is accepted as a simulator input only.",
      "Published shipping rename rule definitions are not available yet.",
      "No live shipping method will be renamed in this phase.",
    ],
  };
}
