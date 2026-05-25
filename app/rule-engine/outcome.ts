import type {
  DeliveryAvailabilityPreview,
  PaymentHidePreview,
  ProductRestrictionPreview,
  ShippingHidePreview,
  ShippingRenamePreview,
} from "./types";

export function composeFinalOutcome(input: {
  pincodeMatched: boolean;
  delivery: DeliveryAvailabilityPreview;
  productRestrictions: ProductRestrictionPreview;
  shippingHide: ShippingHidePreview;
  shippingRename: ShippingRenamePreview;
  paymentHide: PaymentHidePreview;
}) {
  const summary = [
    "Checkout behavior unchanged: preview only.",
    input.pincodeMatched
      ? "Pincode matched the published config snapshot."
      : "Pincode did not match the published config snapshot.",
    input.productRestrictions.matchedRules.length > 0
      ? "Product restriction rules would match in a future validation function."
      : "No product restriction rule matched.",
    input.shippingHide.matchedRules.length > 0
      ? "Shipping hide rules would match in a future delivery function."
      : "No shipping hide rule matched.",
    input.shippingRename.matchedRules.length > 0
      ? "Shipping rename rules would match in a future delivery function."
      : "No shipping rename rule matched.",
    input.paymentHide.matchedRules.length > 0
      ? "Payment hide rules would match in a future payment function."
      : "No payment hide rule matched.",
    "No live validation block will occur in this phase.",
    "No live shipping method hide or rename will occur in this phase.",
    "No live payment method hide will occur in this phase.",
  ];

  return {
    status: "preview_only",
    summary,
  } as const;
}
