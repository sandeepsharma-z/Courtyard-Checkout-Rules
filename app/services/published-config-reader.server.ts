import { Buffer } from "node:buffer";

import {
  PUBLISHED_CONFIG_SCHEMA_VERSION,
  type PublishedConfigSnapshotPayload,
  type PublishedPincodeRecord,
} from "../types/published-config";

type ParsedConfigResult =
  | {
      status: "missing";
      payload: null;
      errors: string[];
      warnings: string[];
      payloadSizeBytes: number;
    }
  | {
      status: "invalid";
      payload: null;
      errors: string[];
      warnings: string[];
      payloadSizeBytes: number;
    }
  | {
      status: "valid";
      payload: PublishedConfigSnapshotPayload;
      errors: string[];
      warnings: string[];
      payloadSizeBytes: number;
    };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isPublishedPincodeRecord = (
  value: unknown,
): value is PublishedPincodeRecord => {
  if (!isObject(value)) return false;

  return [
    "st",
    "di",
    "pc",
    "ln",
    "ag",
    "da",
    "sd",
    "nd",
    "pa",
    "rm",
    "ch",
    "usd",
    "und",
  ].every((key) => isString(value[key]));
};

export function parsePublishedConfigSnapshot(
  rawValue: string | null | undefined,
): ParsedConfigResult {
  if (!rawValue) {
    return {
      status: "missing",
      payload: null,
      errors: ["Published config metafield was not found."],
      warnings: [],
      payloadSizeBytes: 0,
    };
  }

  const payloadSizeBytes = Buffer.byteLength(rawValue, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return {
      status: "invalid",
      payload: null,
      errors: ["Published config metafield contains invalid JSON."],
      warnings: [],
      payloadSizeBytes,
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(parsed)) {
    errors.push("Published config must be a JSON object.");
  }

  if (isObject(parsed)) {
    if (parsed.v !== PUBLISHED_CONFIG_SCHEMA_VERSION) {
      errors.push(
        `Unsupported schema version. Expected ${PUBLISHED_CONFIG_SCHEMA_VERSION}.`,
      );
    }

    if (parsed.kind !== "courtyard_checkout_rules.pincode_config") {
      errors.push("Published config kind is not recognized.");
    }

    if (!isString(parsed.publishedAt)) {
      errors.push("Published config is missing publishedAt.");
    }

    if (!isObject(parsed.source)) {
      errors.push("Published config is missing source.");
    }

    if (!isObject(parsed.counts) || typeof parsed.counts.records !== "number") {
      errors.push("Published config is missing record counts.");
    }

    const records = isObject(parsed.pincodeData)
      ? parsed.pincodeData.records
      : undefined;

    if (!Array.isArray(records)) {
      errors.push("Published config is missing pincode records.");
    } else {
      const malformedRecordCount = records.filter(
        (record) => !isPublishedPincodeRecord(record),
      ).length;

      if (malformedRecordCount > 0) {
        errors.push(`${malformedRecordCount} pincode records are malformed.`);
      }

      if (
        isObject(parsed.counts) &&
        typeof parsed.counts.records === "number" &&
        parsed.counts.records !== records.length
      ) {
        warnings.push(
          `Payload count says ${parsed.counts.records}, but ${records.length} records were parsed.`,
        );
      }
    }
  }

  if (errors.length > 0) {
    return {
      status: "invalid",
      payload: null,
      errors,
      warnings,
      payloadSizeBytes,
    };
  }

  return {
    status: "valid",
    payload: parsed as PublishedConfigSnapshotPayload,
    errors,
    warnings,
    payloadSizeBytes,
  };
}
