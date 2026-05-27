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

type AutoRulePreviewEntry = {
  type: "ShippingHide" | "ShippingRename" | "ProductRestriction";
  name: string;
  description: string;
  pincodes: string[];
  newLabel?: string;
};

export async function previewAutoRulesFromBatch(batchId: string): Promise<AutoRulePreviewEntry[]> {
  const records = await prisma.pincodeRecord.findMany({
    where: { batchId, rowStatus: "valid", pincode: { not: "" } },
    select: {
      pincode: true,
      sameDayDeliveryRule: true,
      updatedSameDayRule: true,
    },
  });

  const sameDayLabels = new Map<string, string[]>();

  for (const r of records) {
    const sameDayLabel = importedSameDayLabel(r);
    if (sameDayLabel) {
      const pincodes = sameDayLabels.get(sameDayLabel) ?? [];
      pincodes.push(r.pincode);
      sameDayLabels.set(sameDayLabel, pincodes);
    }
  }

  const preview: AutoRulePreviewEntry[] = [];

  for (const [label, pincodes] of sameDayLabels) {
    preview.push({
      type: "ShippingRename",
      name: `Rename shipping - imported label ${preview.length + 1}`,
      description: `Rename configured shipping method for ${pincodes.length} pincodes using imported delivery text`,
      pincodes,
      newLabel: label,
    });
  }

  return preview;
}

export async function generateAutoRulesFromBatch(batchId: string) {
  const rules = await previewAutoRulesFromBatch(batchId);
  const noteTag = `auto:${batchId}`;

  const base = (rule: AutoRulePreviewEntry) => ({
    name: rule.name,
    enabled: false,
    priority: 100,
    pincodesJson: JSON.stringify(rule.pincodes),
    areaGroupsJson: "[]",
    productTagsJson: "[]",
    deliveryAvailabilityText: "",
    notes: noteTag,
  });

  let created = 0;
  for (const rule of rules) {
    if (rule.type === "ShippingHide") {
      await prisma.shippingHideRule.create({
        data: { ...base(rule), shippingMethodMappingId: "", cutoffRuleSettingId: "" },
      });
      created++;
    } else if (rule.type === "ShippingRename") {
      await prisma.shippingRenameRule.create({
        data: {
          ...base(rule),
          shippingMethodMappingId: "",
          cutoffRuleSettingId: "",
          newLabel: rule.newLabel ?? "",
        },
      });
      created++;
    } else if (rule.type === "ProductRestriction") {
      await prisma.productRestrictionRule.create({
        data: { ...base(rule), validationMessage: "" },
      });
      created++;
    }
  }

  return created;
}

export async function getActivePincodeRuleOptions() {
  const records = await prisma.pincodeRecord.findMany({
    where: { isActive: true, pincode: { not: "" } },
    orderBy: [{ pincode: "asc" }, { rowNumber: "asc" }],
    select: {
      id: true,
      pincode: true,
      areaGroup: true,
      deliveryAvailability: true,
      district: true,
      locationName: true,
      state: true,
    },
  });

  const pincodeRecords = records.filter((record) => isPincodeValue(record.pincode));

  const uniqueRecords = Array.from(
    new Map(pincodeRecords.map((record) => [record.pincode, record])).values(),
  );

  return {
    pincodes: uniqueRecords,
    areaGroups: Array.from(new Set(pincodeRecords.map((record) => record.areaGroup).filter(Boolean))).sort(),
    deliveryAvailabilityValues: Array.from(
      new Set(pincodeRecords.map((record) => record.deliveryAvailability).filter(Boolean)),
    ).sort(),
  };
}

function isPincodeValue(value: string) {
  return /^\d{6}$/.test(value.trim());
}

function importedSameDayLabel(record: {
  sameDayDeliveryRule: string;
  updatedSameDayRule: string;
}) {
  return (record.updatedSameDayRule || record.sameDayDeliveryRule || "").trim();
}
