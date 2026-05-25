import prisma from "../db.server";
import type { ParsedPincodeImport } from "../types/pincode-import";

export async function createPincodeImportBatch(parsedImport: ParsedPincodeImport) {
  return prisma.pincodeImportBatch.create({
    data: {
      filename: parsedImport.filename,
      totalRows: parsedImport.summary.totalRows,
      validRows: parsedImport.summary.validRows,
      invalidRows: parsedImport.summary.invalidRows,
      duplicateRows: parsedImport.summary.duplicateRows,
      missingHeadersJson: JSON.stringify(parsedImport.missingHeaders),
      extraHeadersJson: JSON.stringify(parsedImport.extraHeaders),
      records: {
        create: parsedImport.rows.map((row) => ({
          rowNumber: row.rowNumber,
          rowStatus: row.rowStatus,
          rowErrorsJson: JSON.stringify(row.rowErrors),
          state: row.values.state,
          district: row.values.district,
          pincode: row.values.pincode,
          locationName: row.values.location_name,
          areaGroup: row.values.area_group,
          deliveryAvailability: row.values.delivery_availability,
          sameDayDeliveryRule: row.values.same_day_delivery_rule,
          nextDayDeliveryRule: row.values.next_day_delivery_rule,
          productAvailabilityRule: row.values.product_availability_rule,
          remarks: row.values.remarks,
          chargesPricingText: row.values.charges_pricing_text,
          updatedSameDayRule: row.values.updated_same_day_rule,
          updatedNextDayRule: row.values.updated_next_day_rule,
        })),
      },
    },
  });
}

export async function approvePincodeImportBatch(batchId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.pincodeImportBatch.findUnique({
      where: { id: batchId },
      select: { id: true, status: true },
    });

    if (!batch) {
      throw new Error("Import batch not found.");
    }

    await tx.pincodeRecord.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    await tx.pincodeRecord.updateMany({
      where: { batchId, rowStatus: "valid" },
      data: { isActive: true },
    });

    return tx.pincodeImportBatch.update({
      where: { id: batchId },
      data: {
        status: "approved",
        approvedAt: new Date(),
      },
    });
  });
}

export async function getImportBatchForPreview(batchId?: string) {
  if (!batchId) {
    return prisma.pincodeImportBatch.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        records: {
          orderBy: { rowNumber: "asc" },
          take: 50,
        },
      },
    });
  }

  return prisma.pincodeImportBatch.findUnique({
    where: { id: batchId },
    include: {
      records: {
        orderBy: { rowNumber: "asc" },
        take: 50,
      },
    },
  });
}

export async function getRecentImportBatches() {
  return prisma.pincodeImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function getActivePincodeSummary() {
  const [activeCount, recentRecords, approvedBatch] = await Promise.all([
    prisma.pincodeRecord.count({ where: { isActive: true } }),
    prisma.pincodeRecord.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.pincodeImportBatch.findFirst({
      where: { status: "approved" },
      orderBy: { approvedAt: "desc" },
    }),
  ]);

  return {
    activeCount,
    recentRecords,
    approvedBatch,
  };
}
