import prisma from "../db.server";

const splitList = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getString = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const getPriority = (formData: FormData) => {
  const priority = Number(getString(formData, "priority"));
  return Number.isFinite(priority) ? priority : 100;
};

const listJson = (formData: FormData, key: string) =>
  JSON.stringify(splitList(formData.get(key)));

export async function getRuleManagerData() {
  const [
    productRestrictionRules,
    shippingMethodMappings,
    paymentMethodMappings,
    shippingHideRules,
    shippingRenameRules,
    paymentHideRules,
    cutoffRuleSettings,
  ] = await Promise.all([
    prisma.productRestrictionRule.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.shippingMethodMapping.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.paymentMethodMapping.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.shippingHideRule.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.shippingRenameRule.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.paymentHideRule.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.cutoffRuleSetting.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    productRestrictionRules,
    shippingMethodMappings,
    paymentMethodMappings,
    shippingHideRules,
    shippingRenameRules,
    paymentHideRules,
    cutoffRuleSettings,
  };
}

export async function handleRuleManagerAction(formData: FormData) {
  const intent = getString(formData, "intent");
  const id = getString(formData, "id");

  if (intent.endsWith(":toggle") && id) {
    return toggleRule(intent.replace(":toggle", ""), id);
  }

  if (intent.endsWith(":delete") && id) {
    return deleteRule(intent.replace(":delete", ""), id);
  }

  switch (intent) {
    case "productRestriction:create":
      return prisma.productRestrictionRule.create({
        data: {
          name: getString(formData, "name"),
          enabled: formData.get("enabled") === "on",
          priority: getPriority(formData),
          productTagsJson: listJson(formData, "productTags"),
          pincodesJson: listJson(formData, "pincodes"),
          areaGroupsJson: listJson(formData, "areaGroups"),
          deliveryAvailabilityText: getString(formData, "deliveryAvailabilityText"),
          validationMessage: getString(formData, "validationMessage"),
          notes: getString(formData, "notes"),
        },
      });
    case "shippingMapping:create":
      return prisma.shippingMethodMapping.create({
        data: methodMappingData(formData),
      });
    case "paymentMapping:create":
      return prisma.paymentMethodMapping.create({
        data: methodMappingData(formData),
      });
    case "shippingHide:create":
      return prisma.shippingHideRule.create({
        data: shippingRuleData(formData),
      });
    case "shippingRename:create":
      return prisma.shippingRenameRule.create({
        data: {
          ...shippingRuleData(formData),
          newLabel: getString(formData, "newLabel"),
        },
      });
    case "paymentHide:create":
      return prisma.paymentHideRule.create({
        data: {
          name: getString(formData, "name"),
          enabled: formData.get("enabled") === "on",
          priority: getPriority(formData),
          paymentMethodMappingId: getString(formData, "paymentMethodMappingId"),
          cutoffRuleSettingId: getString(formData, "cutoffRuleSettingId"),
          selectedShippingContains: getString(formData, "selectedShippingContains"),
          productTagsJson: listJson(formData, "productTags"),
          pincodesJson: listJson(formData, "pincodes"),
          areaGroupsJson: listJson(formData, "areaGroups"),
          deliveryAvailabilityText: getString(formData, "deliveryAvailabilityText"),
          notes: getString(formData, "notes"),
        },
      });
    case "cutoff:create":
      return prisma.cutoffRuleSetting.create({
        data: {
          name: getString(formData, "name"),
          enabled: formData.get("enabled") === "on",
          priority: getPriority(formData),
          timeValue: getString(formData, "timeValue"),
          timezone: getString(formData, "timezone"),
          matchMode: getString(formData, "matchMode") || "before",
          notes: getString(formData, "notes"),
        },
      });
    default:
      throw new Error("Unsupported rule manager action.");
  }
}

function methodMappingData(formData: FormData) {
  return {
    name: getString(formData, "name"),
    enabled: formData.get("enabled") === "on",
    priority: getPriority(formData),
    matchType: getString(formData, "matchType") || "exact",
    matchValue: getString(formData, "matchValue"),
    notes: getString(formData, "notes"),
  };
}

function shippingRuleData(formData: FormData) {
  return {
    name: getString(formData, "name"),
    enabled: formData.get("enabled") === "on",
    priority: getPriority(formData),
    shippingMethodMappingId: getString(formData, "shippingMethodMappingId"),
    cutoffRuleSettingId: getString(formData, "cutoffRuleSettingId"),
    productTagsJson: listJson(formData, "productTags"),
    pincodesJson: listJson(formData, "pincodes"),
    areaGroupsJson: listJson(formData, "areaGroups"),
    deliveryAvailabilityText: getString(formData, "deliveryAvailabilityText"),
    notes: getString(formData, "notes"),
  };
}

async function toggleRule(kind: string, id: string) {
  switch (kind) {
    case "productRestriction": {
      const item = await prisma.productRestrictionRule.findUnique({ where: { id } });
      return item
        ? prisma.productRestrictionRule.update({
            where: { id },
            data: { enabled: !item.enabled },
          })
        : null;
    }
    case "shippingMapping": {
      const item = await prisma.shippingMethodMapping.findUnique({ where: { id } });
      return item
        ? prisma.shippingMethodMapping.update({
            where: { id },
            data: { enabled: !item.enabled },
          })
        : null;
    }
    case "paymentMapping": {
      const item = await prisma.paymentMethodMapping.findUnique({ where: { id } });
      return item
        ? prisma.paymentMethodMapping.update({
            where: { id },
            data: { enabled: !item.enabled },
          })
        : null;
    }
    case "shippingHide": {
      const item = await prisma.shippingHideRule.findUnique({ where: { id } });
      return item
        ? prisma.shippingHideRule.update({
            where: { id },
            data: { enabled: !item.enabled },
          })
        : null;
    }
    case "shippingRename": {
      const item = await prisma.shippingRenameRule.findUnique({ where: { id } });
      return item
        ? prisma.shippingRenameRule.update({
            where: { id },
            data: { enabled: !item.enabled },
          })
        : null;
    }
    case "paymentHide": {
      const item = await prisma.paymentHideRule.findUnique({ where: { id } });
      return item
        ? prisma.paymentHideRule.update({
            where: { id },
            data: { enabled: !item.enabled },
          })
        : null;
    }
    case "cutoff": {
      const item = await prisma.cutoffRuleSetting.findUnique({ where: { id } });
      return item
        ? prisma.cutoffRuleSetting.update({
            where: { id },
            data: { enabled: !item.enabled },
          })
        : null;
    }
    default:
      throw new Error("Unsupported toggle action.");
  }
}

async function deleteRule(kind: string, id: string) {
  switch (kind) {
    case "productRestriction":
      return prisma.productRestrictionRule.delete({ where: { id } });
    case "shippingMapping":
      return prisma.shippingMethodMapping.delete({ where: { id } });
    case "paymentMapping":
      return prisma.paymentMethodMapping.delete({ where: { id } });
    case "shippingHide":
      return prisma.shippingHideRule.delete({ where: { id } });
    case "shippingRename":
      return prisma.shippingRenameRule.delete({ where: { id } });
    case "paymentHide":
      return prisma.paymentHideRule.delete({ where: { id } });
    case "cutoff":
      return prisma.cutoffRuleSetting.delete({ where: { id } });
    default:
      throw new Error("Unsupported delete action.");
  }
}
