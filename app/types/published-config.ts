export const PUBLISHED_CONFIG_SCHEMA_VERSION = 1;
export const PUBLISHED_CONFIG_NAMESPACE = "courtyard_checkout_rules";
export const PUBLISHED_CONFIG_KEY = "published_config";
export const PUBLISHED_CONFIG_TYPE = "json";

export const DEFAULT_SINGLE_METAFIELD_MAX_BYTES = 90_000;

export type PublishedPincodeRecord = {
  st: string;
  di: string;
  pc: string;
  ln: string;
  ag: string;
  da: string;
  sd: string;
  nd: string;
  pa: string;
  rm: string;
  ch: string;
  usd: string;
  und: string;
};

export type PublishedConfigSnapshotPayload = {
  v: typeof PUBLISHED_CONFIG_SCHEMA_VERSION;
  kind: "courtyard_checkout_rules.pincode_config";
  publishedAt: string;
  source: {
    type: "local_import_batch";
    batchId: string;
    filename: string;
  };
  counts: {
    records: number;
  };
  pincodeData: {
    records: PublishedPincodeRecord[];
  };
};

export type BuiltPublishedConfigSnapshot = {
  payload: PublishedConfigSnapshotPayload;
  payloadJson: string;
  payloadSizeBytes: number;
  recordCount: number;
  sourceBatchId: string;
  sourceFilename: string;
  maxBytes: number;
  isTooLarge: boolean;
};
