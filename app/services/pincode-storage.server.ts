import prisma from "../db.server";
import type { ParsedPincodeImport } from "../types/pincode-import";

export async function createPincodeImportBatch(
  parsedImport: ParsedPincodeImport,
) {
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

export async function deletePincodeImportBatch(batchId: string) {
  const noteTag = `auto:${batchId}`;

  return prisma.$transaction(async (tx) => {
    await tx.shippingHideRule.deleteMany({
      where: { notes: { contains: noteTag } },
    });
    await tx.shippingRenameRule.deleteMany({
      where: { notes: { contains: noteTag } },
    });
    await tx.productRestrictionRule.deleteMany({
      where: { notes: { contains: noteTag } },
    });

    return tx.pincodeImportBatch.delete({
      where: { id: batchId },
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
  source: "same_day_delivery" | "next_day_delivery" | "product_availability";
  newLabel?: string;
  willAutoEnable: boolean;
};

export async function previewAutoRulesFromBatch(
  batchId: string,
): Promise<AutoRulePreviewEntry[]> {
  const [records, enabledMappingCount] = await Promise.all([
    prisma.pincodeRecord.findMany({
      where: { batchId, rowStatus: "valid", pincode: { not: "" } },
      select: {
        pincode: true,
        nextDayDeliveryRule: true,
        productAvailabilityRule: true,
        sameDayDeliveryRule: true,
        updatedNextDayRule: true,
        updatedSameDayRule: true,
      },
    }),
    prisma.shippingMethodMapping.count({ where: { enabled: true } }),
  ]);

  const sameDayLabels = new Map<string, string[]>();
  const nextDayLabels = new Map<string, string[]>();
  const productAvailabilityRules = new Map<string, string[]>();

  for (const r of records) {
    const sameDayLabel = importedSameDayLabel(r);
    if (sameDayLabel) {
      addPincodeToGroup(sameDayLabels, sameDayLabel, r.pincode);
    }

    const nextDayLabel = importedNextDayLabel(r);
    if (nextDayLabel) {
      addPincodeToGroup(nextDayLabels, nextDayLabel, r.pincode);
    }

    const productAvailabilityText = r.productAvailabilityRule.trim();
    if (productAvailabilityText) {
      addPincodeToGroup(
        productAvailabilityRules,
        productAvailabilityText,
        r.pincode,
      );
    }
  }

  const preview: AutoRulePreviewEntry[] = [];
  const hasOneEnabledMapping = enabledMappingCount === 1;

  for (const [label, pincodes] of sameDayLabels) {
    preview.push({
      type: "ShippingRename",
      name: `Imported same-day delivery label ${preview.length + 1}`,
      description: `Rename a configured shipping method for ${pincodes.length} pincodes using imported same-day delivery text.`,
      pincodes,
      source: "same_day_delivery",
      newLabel: label,
      willAutoEnable: hasOneEnabledMapping,
    });
  }

  for (const [label, pincodes] of nextDayLabels) {
    preview.push({
      type: "ShippingRename",
      name: `Imported next-day delivery label ${preview.length + 1}`,
      description: `Rename a configured shipping method for ${pincodes.length} pincodes using imported next-day delivery text.`,
      pincodes,
      source: "next_day_delivery",
      newLabel: label,
      willAutoEnable: hasOneEnabledMapping,
    });
  }

  for (const [availabilityText, pincodes] of productAvailabilityRules) {
    preview.push({
      type: "ProductRestriction",
      name: `Imported product availability rule ${preview.length + 1}`,
      description: `Create a product availability restriction draft for ${pincodes.length} pincodes using imported product availability text.`,
      pincodes,
      source: "product_availability",
      newLabel: availabilityText,
      willAutoEnable: false,
    });
  }

  return preview;
}

export async function generateAutoRulesFromBatch(batchId: string) {
  const [rules, enabledMappings] = await Promise.all([
    previewAutoRulesFromBatch(batchId),
    prisma.shippingMethodMapping.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    }),
  ]);
  const noteTag = `auto:${batchId}`;
  const mappingId = enabledMappings.length === 1 ? enabledMappings[0].id : "";

  await prisma.$transaction([
    prisma.shippingHideRule.deleteMany({
      where: { notes: { contains: noteTag } },
    }),
    prisma.shippingRenameRule.deleteMany({
      where: { notes: { contains: noteTag } },
    }),
    prisma.productRestrictionRule.deleteMany({
      where: { notes: { contains: noteTag } },
    }),
  ]);

  const base = (rule: AutoRulePreviewEntry) => ({
    name: rule.name,
    enabled: rule.willAutoEnable,
    priority: 100,
    pincodesJson: JSON.stringify(rule.pincodes),
    areaGroupsJson: "[]",
    productTagsJson: "[]",
    deliveryAvailabilityText: "",
    notes: `${noteTag}; source:${rule.source}`,
  });

  let created = 0;
  for (const rule of rules) {
    if (rule.type === "ShippingHide") {
      await prisma.shippingHideRule.create({
        data: {
          ...base(rule),
          shippingMethodMappingId: "",
          cutoffRuleSettingId: "",
        },
      });
      created++;
    } else if (rule.type === "ShippingRename") {
      await prisma.shippingRenameRule.create({
        data: {
          ...base(rule),
          shippingMethodMappingId: mappingId,
          cutoffRuleSettingId: "",
          newLabel: rule.newLabel ?? "",
        },
      });
      created++;
    } else if (rule.type === "ProductRestriction") {
      await prisma.productRestrictionRule.create({
        data: {
          ...base(rule),
          enabled: false,
          deliveryAvailabilityText: rule.newLabel ?? "",
          validationMessage: "",
        },
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

  const pincodeRecords = records.filter((record) =>
    isPincodeValue(record.pincode),
  );

  const uniqueRecords = Array.from(
    new Map(pincodeRecords.map((record) => [record.pincode, record])).values(),
  );

  return {
    pincodes: uniqueRecords,
    areaGroups: Array.from(
      new Set(pincodeRecords.map((record) => record.areaGroup).filter(Boolean)),
    ).sort(),
    deliveryAvailabilityValues: Array.from(
      new Set(
        pincodeRecords
          .map((record) => record.deliveryAvailability)
          .filter(Boolean),
      ),
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

function importedNextDayLabel(record: {
  nextDayDeliveryRule: string;
  updatedNextDayRule: string;
}) {
  return (record.updatedNextDayRule || record.nextDayDeliveryRule || "").trim();
}

function addPincodeToGroup(
  groups: Map<string, string[]>,
  label: string,
  pincode: string,
) {
  const value = label.trim();
  if (!value) return;

  const pincodes = groups.get(value) ?? [];
  pincodes.push(pincode);
  groups.set(value, pincodes);
}
