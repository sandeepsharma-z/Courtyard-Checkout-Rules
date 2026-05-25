import type {
  PublishedConfigSnapshotPayload,
  PublishedPincodeRecord,
} from "../types/published-config";

export type RuleEngineInputs = {
  pincode: string;
  cartTotal: string;
  productTags: string[];
  selectedShippingMethod: string;
  selectedPaymentMethod: string;
  currentTime: string;
};

export type PreviewStatus =
  | "matched"
  | "not_matched"
  | "preview_only"
  | "not_configured";

export type PincodeMatchPreview = {
  status: "matched" | "not_matched";
  input: string;
  record: PublishedPincodeRecord | null;
  notes: string[];
};

export type DeliveryAvailabilityPreview = {
  status: PreviewStatus;
  areaGroup: string;
  deliveryAvailability: string;
  sameDayDeliveryRule: string;
  nextDayDeliveryRule: string;
  remarks: string;
  chargesPricingText: string;
  notes: string[];
};

export type ProductRestrictionPreview = {
  status: PreviewStatus;
  inputTags: string[];
  productAvailabilityRule: string;
  notes: string[];
};

export type ShippingHidePreview = {
  status: PreviewStatus;
  selectedShippingMethod: string;
  hiddenMethods: string[];
  notes: string[];
};

export type ShippingRenamePreview = {
  status: PreviewStatus;
  selectedShippingMethod: string;
  renamedMethod: string;
  notes: string[];
};

export type PaymentHidePreview = {
  status: PreviewStatus;
  selectedPaymentMethod: string;
  hiddenPaymentMethods: string[];
  notes: string[];
};

export type CutoffPreview = {
  status: PreviewStatus;
  currentTime: string;
  parsedTime: string;
  notes: string[];
};

export type RuleEngineOutcome = {
  schemaVersion: number;
  configRecordCount: number;
  pincode: PincodeMatchPreview;
  delivery: DeliveryAvailabilityPreview;
  productRestrictions: ProductRestrictionPreview;
  shippingHide: ShippingHidePreview;
  shippingRename: ShippingRenamePreview;
  paymentHide: PaymentHidePreview;
  cutoff: CutoffPreview;
  finalOutcome: {
    status: "preview_only";
    summary: string[];
  };
};

export type RuleEngineContext = {
  config: PublishedConfigSnapshotPayload;
  inputs: RuleEngineInputs;
};
