import type { PublishedRuleConfig } from "./rule-config";

export const PUBLISHED_CONFIG_SCHEMA_VERSION = 2;
export const PUBLISHED_CONFIG_NAMESPACE = "courtyard_checkout_rules";
export const PUBLISHED_CONFIG_KEY = "published_config";
export const PUBLISHED_CONFIG_TYPE = "json";

export const DEFAULT_SINGLE_METAFIELD_MAX_BYTES = 90_000;

// The checkout Functions only read pc / ag / da. The other descriptive CSV
// columns are omitted from the published metafield to keep it under Shopify's
// 10 KB function-input limit (a larger metafield value is not delivered to the
// Function at all). They remain optional here so admin preview tools and older
// snapshots that still carry them keep type-checking.
export type PublishedPincodeRecord = {
  pc: string;
  ag: string;
  da: string;
  st?: string;
  di?: string;
  ln?: string;
  sd?: string;
  nd?: string;
  pa?: string;
  rm?: string;
  ch?: string;
  usd?: string;
  und?: string;
};

export type PublishedConfigSnapshotPayload = {
  v: number;
  kind: "courtyard_checkout_rules.pincode_config";
  publishedAt: string;
  source: {
    type: "local_import_batch" | "manual_pincode_rules";
    batchId: string;
    filename: string;
  };
  counts: {
    records: number;
  };
  pincodeData: {
    records: PublishedPincodeRecord[];
  };
  settings?: {
    blockUnknownPincode: boolean;
    unknownPincodeMessage: string;
    autoRenameDeliveryOption: boolean;
    deliveryLabelSource: "same_day" | "next_day" | "updated_first";
    hideOtherDeliveryOptions: boolean;
    defaultShippingMethod: string;
  };
  rules?: PublishedRuleConfig;
};

export type BuiltPublishedConfigSnapshot = {
  payload: PublishedConfigSnapshotPayload;
  payloadJson: string;
  payloadSizeBytes: number;
  recordCount: number;
  sourceBatchId: string | null;
  sourceFilename: string;
  maxBytes: number;
  isTooLarge: boolean;
};
