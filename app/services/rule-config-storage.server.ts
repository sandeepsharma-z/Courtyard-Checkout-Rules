import prisma from "../db.server";

const splitList = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(/[,\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const splitPincodeList = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "");
  const matches = text.match(/[1-9]\d{5}/g);
  return matches?.length ? Array.from(new Set(matches)) : splitList(value);
};

const getString = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const getPriority = (formData: FormData) => {
  const priority = Number(getString(formData, "priority"));
  return Number.isFinite(priority) ? priority : 100;
};

const listJson = (formData: FormData, key: string) => {
  const splitter = key.toLowerCase().includes("pincode")
    ? splitPincodeList
    : splitList;
  const values = formData.getAll(key).flatMap((value) => splitter(value));
  return JSON.stringify(Array.from(new Set(values)));
};

const getListValues = (formData: FormData, key: string) =>
  formData
    .getAll(key)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

function assertProductRestrictionCanBeEnabled(input: {
  enabled: boolean;
  validationMessage: string;
}) {
  if (input.enabled && !input.validationMessage) {
    throw new Error(
      "Product validation rules need an error message before they can be enabled.",
    );
  }
}

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

  if (intent.endsWith(":update") && id) {
    return updateRule(intent.replace(":update", ""), id, formData);
  }

  if (intent.endsWith(":delete") && id) {
    return deleteRule(intent.replace(":delete", ""), id);
  }

  switch (intent) {
    case "productRestriction:create":
      assertProductRestrictionCanBeEnabled({
        enabled: formData.get("enabled") === "on",
        validationMessage: getString(formData, "validationMessage"),
      });
      return prisma.productRestrictionRule.create({
        data: {
          name: getString(formData, "name"),
          enabled: formData.get("enabled") === "on",
          priority: getPriority(formData),
          productTagsJson: listJson(formData, "productTags"),
          pincodesJson: listJson(formData, "pincodes"),
          areaGroupsJson: listJson(formData, "areaGroups"),
          deliveryAvailabilityText: getString(
            formData,
            "deliveryAvailabilityText",
          ),
          validationMessage: getString(formData, "validationMessage"),
          notes: getString(formData, "notes"),
        },
      });
    case "productRestriction:createMulti": {
      const blockCount = Math.min(
        Number(getString(formData, "blockCount")) || 1,
        20,
      );
      const baseName = getString(formData, "name");
      const basePriority = getPriority(formData);
      const baseEnabled = formData.get("enabled") === "on";
      const baseNotes = getString(formData, "notes");
      const creates = Array.from({ length: blockCount }, (_, i) => {
        const pincodes = listJson(formData, `pincodes_${i}`);
        const validationMessage = getString(formData, `validationMessage_${i}`);
        if (pincodes === "[]" && !validationMessage) return null;
        assertProductRestrictionCanBeEnabled({
          enabled: baseEnabled,
          validationMessage,
        });
        return prisma.productRestrictionRule.create({
          data: {
            name:
              getString(formData, `name_${i}`) || baseName || `Rule ${i + 1}`,
            enabled: baseEnabled,
            priority: basePriority + i,
            productTagsJson: listJson(formData, `productTags_${i}`),
            pincodesJson: pincodes,
            areaGroupsJson: listJson(formData, `areaGroups_${i}`),
            deliveryAvailabilityText: getString(
              formData,
              `deliveryAvailabilityText_${i}`,
            ),
            validationMessage,
            notes: baseNotes,
          },
        });
      }).filter(Boolean);
      return Promise.all(creates);
    }
    case "shippingMapping:create":
      return prisma.shippingMethodMapping.create({
        data: methodMappingData(formData),
      });
    case "paymentMapping:create":
      return prisma.paymentMethodMapping.create({
        data: methodMappingData(formData),
      });
    case "shippingHide:create":
      return createShippingHideRules(formData);
    case "shippingHide:createMulti":
      return createShippingHideRulesMulti(formData);
    case "shippingRename:create":
      return createShippingRenameRules(formData);
    case "paymentHide:create":
      return prisma.paymentHideRule.create({
        data: {
          name: getString(formData, "name"),
          enabled: formData.get("enabled") === "on",
          priority: getPriority(formData),
          paymentMethodMappingId: getString(formData, "paymentMethodMappingId"),
          selectedPaymentMethodsJson: getString(
            formData,
            "selectedPaymentMethodsJson",
          ) || "[]",
          cutoffRuleSettingId: getString(formData, "cutoffRuleSettingId"),
          selectedShippingContains: getString(
            formData,
            "selectedShippingContains",
          ),
          productTagsJson: listJson(formData, "productTags"),
          pincodesJson: listJson(formData, "pincodes"),
          areaGroupsJson: listJson(formData, "areaGroups"),
          deliveryAvailabilityText: getString(
            formData,
            "deliveryAvailabilityText",
          ),
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

function shippingRuleBaseData(formData: FormData) {
  return {
    name: getString(formData, "name"),
    enabled: formData.get("enabled") === "on",
    priority: getPriority(formData),
    cutoffRuleSettingId: getString(formData, "cutoffRuleSettingId"),
    selectedShippingMethodsJson: getString(
      formData,
      "selectedShippingMethodsJson",
    ) || "[]",
    productTagsJson: listJson(formData, "productTags"),
    pincodesJson: listJson(formData, "pincodes"),
    areaGroupsJson: listJson(formData, "areaGroups"),
    deliveryAvailabilityText: getString(formData, "deliveryAvailabilityText"),
    notes: getString(formData, "notes"),
  };
}

async function createShippingHideRules(formData: FormData) {
  const mappings = getListValues(formData, "shippingMethodMappingId");
  const base = shippingRuleBaseData(formData);

  const methodMatchMode = getString(formData, "hideAction") || "hide";

  if (mappings.length <= 1) {
    return prisma.shippingHideRule.create({
      data: {
        ...base,
        methodMatchMode,
        shippingMethodMappingId: mappings[0] ?? "",
      },
    });
  }

  return prisma.shippingHideRule.createMany({
    data: mappings.map((mappingId, index) => ({
      ...base,
      methodMatchMode,
      name: `${base.name} ${index + 1}`,
      shippingMethodMappingId: mappingId,
    })),
  });
}

async function createShippingHideRulesMulti(formData: FormData) {
  const blockCount = Math.min(Number(getString(formData, "blockCount")) || 1, 20);
  const baseName = getString(formData, "name");
  const basePriority = getPriority(formData);
  const baseEnabled = formData.get("enabled") === "on";
  const baseNotes = getString(formData, "notes");

  const creates = Array.from({ length: blockCount }, (_, i) => {
    const pincodes = listJson(formData, `pincodes_${i}`);
    const selectedShippingMethodsJson =
      getString(formData, `selectedShippingMethodsJson_${i}`) || "[]";

    if (pincodes === "[]" && (selectedShippingMethodsJson === "[]" || !selectedShippingMethodsJson)) {
      return null;
    }

    return prisma.shippingHideRule.create({
      data: {
        name: getString(formData, `name_${i}`) || baseName || `Rule ${i + 1}`,
        enabled: baseEnabled,
        priority: basePriority + i,
        shippingMethodMappingId: "",
        selectedShippingMethodsJson,
        methodMatchMode: getString(formData, `hideAction_${i}`) || "hide",
        cutoffRuleSettingId: getString(formData, `cutoffRuleSettingId_${i}`),
        productTagsJson: listJson(formData, `productTags_${i}`),
        pincodesJson: pincodes,
        areaGroupsJson: listJson(formData, `areaGroups_${i}`),
        deliveryAvailabilityText: getString(
          formData,
          `deliveryAvailabilityText_${i}`,
        ),
        notes: baseNotes,
      },
    });
  }).filter(Boolean);

  return Promise.all(creates);
}

async function createShippingRenameRules(formData: FormData) {
  const mappings = getListValues(formData, "shippingMethodMappingId");
  const labels = getListValues(formData, "newLabel");
  const base = shippingRuleBaseData(formData);

  if (mappings.length <= 1) {
    return prisma.shippingRenameRule.create({
      data: {
        ...base,
        shippingMethodMappingId: mappings[0] ?? "",
        newLabel: labels[0] ?? "",
      },
    });
  }

  return prisma.shippingRenameRule.createMany({
    data: mappings.map((mappingId, index) => ({
      ...base,
      name: `${base.name} ${index + 1}`,
      shippingMethodMappingId: mappingId,
      newLabel: labels[index] ?? "",
    })),
  });
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

async function toggleRule(kind: string, id: string) {
  switch (kind) {
    case "productRestriction": {
      const item = await prisma.productRestrictionRule.findUnique({
        where: { id },
      });
      if (item && !item.enabled) {
        assertProductRestrictionCanBeEnabled({
          enabled: true,
          validationMessage: item.validationMessage,
        });
      }
      return item
        ? prisma.productRestrictionRule.update({
            where: { id },
            data: { enabled: !item.enabled },
          })
        : null;
    }
    case "shippingMapping": {
      const item = await prisma.shippingMethodMapping.findUnique({
        where: { id },
      });
      return item
        ? prisma.shippingMethodMapping.update({
            where: { id },
            data: { enabled: !item.enabled },
          })
        : null;
    }
    case "paymentMapping": {
      const item = await prisma.paymentMethodMapping.findUnique({
        where: { id },
      });
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
      const item = await prisma.shippingRenameRule.findUnique({
        where: { id },
      });
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

async function updateRule(kind: string, id: string, formData: FormData) {
  switch (kind) {
    case "productRestriction":
      assertProductRestrictionCanBeEnabled({
        enabled: formData.get("enabled") === "on",
        validationMessage: getString(formData, "validationMessage"),
      });
      return prisma.productRestrictionRule.update({
        where: { id },
        data: {
          name: getString(formData, "name"),
          enabled: formData.get("enabled") === "on",
          priority: getPriority(formData),
          productTagsJson: listJson(formData, "productTags"),
          pincodesJson: listJson(formData, "pincodes"),
          areaGroupsJson: listJson(formData, "areaGroups"),
          deliveryAvailabilityText: getString(
            formData,
            "deliveryAvailabilityText",
          ),
          validationMessage: getString(formData, "validationMessage"),
          notes: getString(formData, "notes"),
        },
      });
    case "shippingMapping":
      return prisma.shippingMethodMapping.update({
        where: { id },
        data: methodMappingData(formData),
      });
    case "paymentMapping":
      return prisma.paymentMethodMapping.update({
        where: { id },
        data: methodMappingData(formData),
      });
    case "shippingHide":
      return prisma.shippingHideRule.update({
        where: { id },
        data: {
          ...shippingRuleBaseData(formData),
          methodMatchMode: getString(formData, "hideAction") || "hide",
          shippingMethodMappingId: getString(
            formData,
            "shippingMethodMappingId",
          ),
        },
      });
    case "shippingRename":
      return prisma.shippingRenameRule.update({
        where: { id },
        data: {
          ...shippingRuleBaseData(formData),
          shippingMethodMappingId: getString(
            formData,
            "shippingMethodMappingId",
          ),
          newLabel: getString(formData, "newLabel"),
        },
      });
    case "paymentHide":
      return prisma.paymentHideRule.update({
        where: { id },
        data: {
          name: getString(formData, "name"),
          enabled: formData.get("enabled") === "on",
          priority: getPriority(formData),
          paymentMethodMappingId: getString(formData, "paymentMethodMappingId"),
          selectedPaymentMethodsJson: getString(
            formData,
            "selectedPaymentMethodsJson",
          ) || "[]",
          cutoffRuleSettingId: getString(formData, "cutoffRuleSettingId"),
          selectedShippingContains: getString(
            formData,
            "selectedShippingContains",
          ),
          productTagsJson: listJson(formData, "productTags"),
          pincodesJson: listJson(formData, "pincodes"),
          areaGroupsJson: listJson(formData, "areaGroups"),
          deliveryAvailabilityText: getString(
            formData,
            "deliveryAvailabilityText",
          ),
          notes: getString(formData, "notes"),
        },
      });
    case "cutoff":
      return prisma.cutoffRuleSetting.update({
        where: { id },
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
      throw new Error("Unsupported update action.");
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
