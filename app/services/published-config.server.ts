import prisma from "../db.server";
import {
  DEFAULT_SINGLE_METAFIELD_MAX_BYTES,
  PUBLISHED_CONFIG_SCHEMA_VERSION,
  type BuiltPublishedConfigSnapshot,
  type PublishedConfigSnapshotPayload,
} from "../types/published-config";

const byteSize = (value: string) => Buffer.byteLength(value, "utf8");

export function getSingleMetafieldMaxBytes() {
  const configuredValue = Number(process.env.PUBLISHED_CONFIG_MAX_BYTES);

  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return configuredValue;
  }

  return DEFAULT_SINGLE_METAFIELD_MAX_BYTES;
}

export async function buildPublishedConfigSnapshot(): Promise<BuiltPublishedConfigSnapshot | null> {
  const approvedBatch = await prisma.pincodeImportBatch.findFirst({
    where: { status: "approved" },
    orderBy: { approvedAt: "desc" },
  });

  if (!approvedBatch) {
    return null;
  }

  const records = await prisma.pincodeRecord.findMany({
    where: {
      isActive: true,
      rowStatus: "valid",
    },
    orderBy: [{ pincode: "asc" }, { id: "asc" }],
  });

  if (records.length === 0) {
    return null;
  }

  const payload: PublishedConfigSnapshotPayload = {
    v: PUBLISHED_CONFIG_SCHEMA_VERSION,
    kind: "courtyard_checkout_rules.pincode_config",
    publishedAt: new Date().toISOString(),
    source: {
      type: "local_import_batch",
      batchId: approvedBatch.id,
      filename: approvedBatch.filename,
    },
    counts: {
      records: records.length,
    },
    pincodeData: {
      records: records.map((record) => ({
        st: record.state,
        di: record.district,
        pc: record.pincode,
        ln: record.locationName,
        ag: record.areaGroup,
        da: record.deliveryAvailability,
        sd: record.sameDayDeliveryRule,
        nd: record.nextDayDeliveryRule,
        pa: record.productAvailabilityRule,
        rm: record.remarks,
        ch: record.chargesPricingText,
        usd: record.updatedSameDayRule,
        und: record.updatedNextDayRule,
      })),
    },
  };

  const payloadJson = JSON.stringify(payload);
  const payloadSizeBytes = byteSize(payloadJson);
  const maxBytes = getSingleMetafieldMaxBytes();

  return {
    payload,
    payloadJson,
    payloadSizeBytes,
    recordCount: records.length,
    sourceBatchId: approvedBatch.id,
    sourceFilename: approvedBatch.filename,
    maxBytes,
    isTooLarge: payloadSizeBytes > maxBytes,
  };
}

export async function createPublishHistoryRecord(input: {
  schemaVersion: number;
  status: string;
  shop: string;
  metafieldId?: string;
  sourceBatchId?: string | null;
  sourceFilename?: string;
  recordCount: number;
  payloadSizeBytes: number;
  payloadJson: string;
  message?: string;
  publishedAt?: Date | null;
}) {
  return prisma.publishedConfigSnapshot.create({
    data: {
      schemaVersion: input.schemaVersion,
      status: input.status,
      shop: input.shop,
      metafieldId: input.metafieldId ?? "",
      sourceBatchId: input.sourceBatchId ?? null,
      sourceFilename: input.sourceFilename ?? "",
      recordCount: input.recordCount,
      payloadSizeBytes: input.payloadSizeBytes,
      payloadJson: input.payloadJson,
      message: input.message ?? "",
      publishedAt: input.publishedAt ?? null,
    },
  });
}

export async function getPublishHistory() {
  return prisma.publishedConfigSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getPublishHistorySnapshot(id: string) {
  return prisma.publishedConfigSnapshot.findUnique({
    where: { id },
  });
}
