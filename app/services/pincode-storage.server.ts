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
      locationName: true,
      sameDayDeliveryRule: true,
    },
  });

  const grouped: Record<string, string[]> = {
    notDelivered: [],
    far: [],
    average: [],
    near: [],
  };

  for (const r of records) {
    const loc = (r.locationName ?? "").trim().toLowerCase();
    if (loc === "not delivered" || loc === "not deliverable") {
      grouped.notDelivered.push(r.pincode);
    } else if (loc === "far") {
      grouped.far.push(r.pincode);
    } else if (loc === "average") {
      grouped.average.push(r.pincode);
    } else if (loc === "near") {
      grouped.near.push(r.pincode);
    }
  }

  const preview: AutoRulePreviewEntry[] = [];

  if (grouped.notDelivered.length) {
    preview.push({
      type: "ShippingHide",
      name: "Hide shipping – Not delivered areas",
      description: `Hide all shipping for ${grouped.notDelivered.length} pincodes marked "Not delivered"`,
      pincodes: grouped.notDelivered,
    });
    preview.push({
      type: "ProductRestriction",
      name: "Block products – Not delivered areas",
      description: `Block product checkout for ${grouped.notDelivered.length} pincodes marked "Not delivered"`,
      pincodes: grouped.notDelivered,
    });
  }

  if (grouped.far.length) {
    preview.push({
      type: "ShippingHide",
      name: "Hide same-day shipping – Far areas",
      description: `Hide same-day shipping for ${grouped.far.length} pincodes in "Far" areas`,
      pincodes: grouped.far,
    });
  }

  if (grouped.average.length) {
    preview.push({
      type: "ShippingRename",
      name: "Rename shipping – Average areas (4PM–8PM)",
      description: `Rename same-day label for ${grouped.average.length} pincodes in "Average" areas`,
      pincodes: grouped.average,
      newLabel: "Same Day - 4PM to 8PM",
    });
  }

  if (grouped.near.length) {
    preview.push({
      type: "ShippingRename",
      name: "Rename shipping – Near areas (90 Min)",
      description: `Rename same-day label for ${grouped.near.length} pincodes in "Near" areas`,
      pincodes: grouped.near,
      newLabel: "Same Day - 90 Min Delivery",
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
        data: { ...base(rule), validationMessage: "Delivery not available at this pincode." },
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
