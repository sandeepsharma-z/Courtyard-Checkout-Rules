export const REQUIRED_PINCODE_HEADERS = [
  "state",
  "district",
  "pincode",
  "location_name",
  "area_group",
  "delivery_availability",
  "same_day_delivery_rule",
  "next_day_delivery_rule",
  "product_availability_rule",
  "remarks",
  "charges_pricing_text",
  "updated_same_day_rule",
  "updated_next_day_rule",
] as const;

export type PincodeCsvHeader = (typeof REQUIRED_PINCODE_HEADERS)[number];

export type ParsedPincodeRow = Record<PincodeCsvHeader, string>;

export type ParsedPincodeImportRow = {
  rowNumber: number;
  rowStatus: "valid" | "invalid" | "duplicate";
  rowErrors: string[];
  values: ParsedPincodeRow;
};

export type ParsedPincodeImport = {
  filename: string;
  headers: string[];
  missingHeaders: string[];
  extraHeaders: string[];
  rows: ParsedPincodeImportRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  };
};
