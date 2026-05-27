import { parse } from "csv-parse/sync";

import {
  MINIMUM_PINCODE_HEADERS,
  REQUIRED_PINCODE_HEADERS,
  type ParsedPincodeImport,
  type ParsedPincodeImportRow,
  type ParsedPincodeRow,
  type PincodeCsvHeader,
} from "../types/pincode-import";

const HEADER_ALIASES: Record<string, PincodeCsvHeader> = {
  "ajay's remarks": "remarks",
  "charges": "charges_pricing_text",
  "charges/pricing": "charges_pricing_text",
  "charges pricing": "charges_pricing_text",
  "charges pricing text": "charges_pricing_text",
  "delivery availability": "delivery_availability",
  "district": "district",
  "location": "area_group",
  "location/area name": "location_name",
  "next day delivery": "next_day_delivery_rule",
  "next day delivery rule": "next_day_delivery_rule",
  "pincode": "pincode",
  "pin code": "pincode",
  "postal code": "pincode",
  "product availability": "product_availability_rule",
  "product availability rule": "product_availability_rule",
  "remarks": "remarks",
  "same day delivery": "same_day_delivery_rule",
  "same day delivery rule": "same_day_delivery_rule",
  "sales": "delivery_availability",
  "state": "state",
  "state name": "state",
  "statename": "state",
  "updated next day": "updated_next_day_rule",
  "updated next day delivery": "updated_next_day_rule",
  "updated same day": "updated_same_day_rule",
  "updated same day delivery": "updated_same_day_rule",
  "understanding or area": "location_name",
};

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/\s+/g, " ");

const canonicalHeader = (header: string): PincodeCsvHeader | null => {
  const normalizedHeader = normalizeHeader(header);

  if (REQUIRED_PINCODE_HEADERS.includes(normalizedHeader as PincodeCsvHeader)) {
    return normalizedHeader as PincodeCsvHeader;
  }

  if (normalizedHeader.startsWith("sales")) {
    return "delivery_availability";
  }

  return HEADER_ALIASES[normalizedHeader] ?? null;
};

const emptyRow = (): ParsedPincodeRow =>
  Object.fromEntries(
    REQUIRED_PINCODE_HEADERS.map((header) => [header, ""]),
  ) as ParsedPincodeRow;

const isPincodeValue = (value: string) => /^\d{6}$/.test(value.trim());

export function parsePincodeCsv(
  csvText: string,
  filename: string,
): ParsedPincodeImport {
  const records = parse(csvText, {
    bom: true,
    columns: false,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: false,
  }) as string[][];

  const rawHeaders = records[0] ?? [];
  const headers = rawHeaders.map(normalizeHeader);
  const canonicalHeaders = rawHeaders.map(canonicalHeader);
  const missingHeaders = MINIMUM_PINCODE_HEADERS.filter(
    (requiredHeader) => !canonicalHeaders.includes(requiredHeader),
  );
  const extraHeaders = headers.filter(
    (header, index) => header && !canonicalHeaders[index],
  );
  const headerIndexes = new Map<PincodeCsvHeader, number>();

  canonicalHeaders.forEach((header, index) => {
    if (header && !headerIndexes.has(header)) {
      headerIndexes.set(header, index);
    }
  });
  const seenPincodes = new Set<string>();
  const rows: ParsedPincodeImportRow[] = records.slice(1).map((record, index) => {
    const rowNumber = index + 2;
    const values = emptyRow();

    for (const header of REQUIRED_PINCODE_HEADERS) {
      const cellIndex = headerIndexes.get(header);
      values[header] =
        cellIndex === undefined ? "" : String(record[cellIndex] ?? "").trim();
    }

    const rowErrors: string[] = [];
    if (missingHeaders.length > 0) {
      rowErrors.push("CSV is missing required headers.");
    }
    if (!values.pincode) {
      rowErrors.push("Pincode is required.");
    } else if (!isPincodeValue(values.pincode)) {
      rowErrors.push("Pincode must be a 6 digit numeric value.");
    }

    let rowStatus: ParsedPincodeImportRow["rowStatus"] =
      rowErrors.length > 0 ? "invalid" : "valid";

    if (values.pincode) {
      if (seenPincodes.has(values.pincode)) {
        rowStatus = "duplicate";
        rowErrors.push("Duplicate pincode in uploaded file.");
      } else {
        seenPincodes.add(values.pincode);
      }
    }

    return {
      rowNumber,
      rowStatus,
      rowErrors,
      values,
    };
  });

  const validRows = rows.filter((row) => row.rowStatus === "valid").length;
  const invalidRows = rows.filter((row) => row.rowStatus === "invalid").length;
  const duplicateRows = rows.filter(
    (row) => row.rowStatus === "duplicate",
  ).length;

  return {
    filename,
    headers,
    missingHeaders,
    extraHeaders,
    rows,
    summary: {
      totalRows: rows.length,
      validRows,
      invalidRows,
      duplicateRows,
    },
  };
}
