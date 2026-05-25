import { parse } from "csv-parse/sync";

import {
  REQUIRED_PINCODE_HEADERS,
  type ParsedPincodeImport,
  type ParsedPincodeImportRow,
  type ParsedPincodeRow,
  type PincodeCsvHeader,
} from "../types/pincode-import";

const normalizeHeader = (header: string) => header.trim().toLowerCase();

const emptyRow = (): ParsedPincodeRow =>
  Object.fromEntries(
    REQUIRED_PINCODE_HEADERS.map((header) => [header, ""]),
  ) as ParsedPincodeRow;

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
  const missingHeaders = REQUIRED_PINCODE_HEADERS.filter(
    (requiredHeader) => !headers.includes(requiredHeader),
  );
  const extraHeaders = headers.filter(
    (header) =>
      header && !REQUIRED_PINCODE_HEADERS.includes(header as PincodeCsvHeader),
  );
  const headerIndexes = new Map(headers.map((header, index) => [header, index]));
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
