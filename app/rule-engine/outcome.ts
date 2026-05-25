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
    "No live validation block will occur in this phase.",
    "No live shipping method hide or rename will occur in this phase.",
    "No live payment method hide will occur in this phase.",
  ];

  return {
    status: "preview_only",
    summary,
  } as const;
}
