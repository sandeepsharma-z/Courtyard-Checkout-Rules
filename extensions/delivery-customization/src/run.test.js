import { describe, expect, it } from "vitest";

import { run } from "./run";

describe("delivery customization no-op", () => {
  it("returns no operations when config is missing", () => {
    expect(run({})).toEqual({ operations: [] });
  });

  it("returns no operations when config is unsupported", () => {
    const input = inputWithConfig({ v: 1, kind: "unsupported" });

    expect(run(input)).toEqual({ operations: [] });
  });

  it("hides matching shipping methods from published config", () => {
    const input = inputWithConfig(validConfig());

    expect(run(input)).toEqual({
      operations: [
        { hide: { deliveryOptionHandle: "standard-shipping" } },
      ],
    });
  });

  it("does not hide shipping methods when a product restriction matches — checkout validation handles blocking", () => {
    const config = validConfig({
      productRestrictions: [
        {
          id: "product-restriction",
          name: "Product restriction",
          priority: 1,
          productTags: ["TAG_FROM_ADMIN_CONFIG"],
          pincodes: ["PINCODE_FROM_ADMIN_CONFIG"],
          areaGroups: [],
          deliveryAvailabilityText: "",
          validationMessage: "MESSAGE_FROM_ADMIN_CONFIG",
          notes: "",
        },
      ],
      shippingHideRules: [],
    });

    expect(run(inputWithConfig(config))).toEqual({ operations: [] });
  });

  it("matches product restriction pincodes from pasted or concatenated pincode text", () => {
    const config = validConfig({
      productRestrictions: [
        {
          id: "product-restriction",
          name: "Product restriction",
          priority: 1,
          productTags: ["TAG_FROM_ADMIN_CONFIG"],
          pincodes: ["PINCODE_FROM_ADMIN_CONFIG122506"],
          areaGroups: [],
          deliveryAvailabilityText: "",
          validationMessage: "MESSAGE_FROM_ADMIN_CONFIG",
          notes: "",
        },
      ],
      shippingHideRules: [],
    });

    expect(run(inputWithConfig(config, "122506"))).toEqual({ operations: [] });
  });

  it("does not apply product restriction hiding even when a shipping rule has unsupported conditions", () => {
    const config = validConfig({
      productRestrictions: [
        {
          id: "product-restriction",
          name: "Product restriction",
          priority: 1,
          productTags: ["TAG_FROM_ADMIN_CONFIG"],
          pincodes: ["PINCODE_FROM_ADMIN_CONFIG"],
          areaGroups: [],
          deliveryAvailabilityText: "",
          validationMessage: "MESSAGE_FROM_ADMIN_CONFIG",
          notes: "",
        },
      ],
      shippingHideRules: [
        {
          id: "unsupported-hide-rule",
          name: "Unsupported hide rule",
          priority: 1,
          shippingMethodMappingId: "standard-map",
          cutoffRuleSettingId: "CUTOFF_SETTING_FROM_ADMIN_CONFIG",
          productTags: [],
          pincodes: ["PINCODE_FROM_ADMIN_CONFIG"],
          areaGroups: [],
          deliveryAvailabilityText: "",
          notes: "",
        },
      ],
    });

    expect(run(inputWithConfig(config))).toEqual({ operations: [] });
  });

  it("skips unsupported shipping rules without disabling supported rules", () => {
    const config = validConfig({
      productRestrictions: [],
      shippingHideRules: [
        {
          id: "unsupported-hide-rule",
          name: "Unsupported hide rule",
          priority: 1,
          shippingMethodMappingId: "standard-mapping",
          cutoffRuleSettingId: "CUTOFF_SETTING_FROM_ADMIN_CONFIG",
          productTags: [],
          pincodes: ["PINCODE_FROM_ADMIN_CONFIG"],
          areaGroups: [],
          deliveryAvailabilityText: "",
          notes: "",
        },
        {
          id: "supported-hide-rule",
          name: "Supported hide rule",
          priority: 2,
          shippingMethodMappingId: "standard-map",
          cutoffRuleSettingId: "",
          productTags: [],
          pincodes: ["PINCODE_FROM_ADMIN_CONFIG"],
          areaGroups: [],
          deliveryAvailabilityText: "",
          notes: "",
        },
      ],
    });

    expect(run(inputWithConfig(config))).toEqual({
      operations: [
        { hide: { deliveryOptionHandle: "standard-shipping" } },
      ],
    });
  });

  it("does not hide all shipping methods when product tag input is available and does not match", () => {
    const config = validConfig({
      productRestrictions: [
        {
          id: "product-restriction",
          name: "Product restriction",
          priority: 1,
          productTags: ["TAG_FROM_ADMIN_CONFIG"],
          pincodes: ["PINCODE_FROM_ADMIN_CONFIG"],
          areaGroups: [],
          deliveryAvailabilityText: "",
          validationMessage: "MESSAGE_FROM_ADMIN_CONFIG",
          notes: "",
        },
      ],
      shippingHideRules: [],
    });

    const input = inputWithConfig(config);
    input.cart.lines = [
      {
        merchandise: {
          product: {
            tags: ["OTHER_TAG_FROM_ADMIN_CONFIG"],
          },
        },
      },
    ];

    expect(run(input)).toEqual({ operations: [] });
  });

  it("renames matching shipping methods when no hide rule matches", () => {
    const config = validConfig({
      shippingHideRules: [],
      shippingRenameRules: [
        {
          id: "rename-rule",
          name: "Rename rule",
          priority: 1,
          shippingMethodMappingId: "standard-map",
          cutoffRuleSettingId: "",
          newLabel: "Configured replacement label",
          productTags: [],
          pincodes: [],
          areaGroups: [],
          deliveryAvailabilityText: "",
          notes: "",
        },
      ],
    });

    expect(run(inputWithConfig(config))).toEqual({
      operations: [
        {
          rename: {
            deliveryOptionHandle: "standard-shipping",
            title: "Configured replacement label",
          },
        },
      ],
    });
  });

  it("shows manual pincode delivery text as the shipping method label", () => {
    const config = validConfig({
      settings: {
        autoRenameDeliveryOption: true,
        deliveryLabelSource: "updated_first",
        hideOtherDeliveryOptions: true,
      },
      pincodeData: {
        records: [
          {
            pc: "PINCODE_FROM_ADMIN_CONFIG",
            sd: "SAME_DAY_LABEL_FROM_ADMIN",
            nd: "NEXT_DAY_LABEL_FROM_ADMIN",
            usd: "",
            und: "",
          },
        ],
      },
      productRestrictions: [],
      shippingHideRules: [],
      shippingRenameRules: [],
    });

    const input = inputWithConfig(config);
    input.cart.deliveryGroups[0].deliveryOptions.push({
      handle: "economy-shipping",
      title: "Another shipping method from admin config",
      code: "another-shipping-method-code",
    });

    expect(run(input)).toEqual({
      operations: [
        {
          rename: {
            deliveryOptionHandle: "standard-shipping",
            title: "SAME_DAY_LABEL_FROM_ADMIN",
          },
        },
        { hide: { deliveryOptionHandle: "economy-shipping" } },
      ],
    });
  });

  it("does not auto-rename when the pincode is not configured", () => {
    const config = validConfig({
      settings: {
        autoRenameDeliveryOption: true,
        deliveryLabelSource: "updated_first",
        hideOtherDeliveryOptions: true,
      },
      productRestrictions: [],
      shippingHideRules: [],
      shippingRenameRules: [],
    });

    expect(run(inputWithConfig(config, "654321"))).toEqual({
      operations: [],
    });
  });

  it("gives hide rules priority over rename rules", () => {
    const config = validConfig({
      shippingRenameRules: [
        {
          id: "rename-rule",
          name: "Rename rule",
          priority: 1,
          shippingMethodMappingId: "standard-map",
          cutoffRuleSettingId: "",
          newLabel: "Configured replacement label",
          productTags: [],
          pincodes: [],
          areaGroups: [],
          deliveryAvailabilityText: "",
          notes: "",
        },
      ],
    });

    expect(run(inputWithConfig(config))).toEqual({
      operations: [
        { hide: { deliveryOptionHandle: "standard-shipping" } },
      ],
    });
  });

  it("fails safe when an active delivery rule contains unsupported product tag conditions", () => {
    const config = validConfig({
      shippingHideRules: [
        {
          id: "hide-rule",
          name: "Hide rule",
          priority: 1,
          shippingMethodMappingId: "standard-map",
          cutoffRuleSettingId: "",
          productTags: ["TAG_FROM_ADMIN_CONFIG"],
          pincodes: [],
          areaGroups: [],
          deliveryAvailabilityText: "",
          notes: "",
        },
      ],
    });

    expect(run(inputWithConfig(config))).toEqual({ operations: [] });
  });
});

function inputWithConfig(config, zip = "PINCODE_FROM_ADMIN_CONFIG") {
  return {
    cart: {
      deliveryGroups: [
        {
          deliveryAddress: {
            zip,
          },
          deliveryOptions: [
            {
              handle: "standard-shipping",
              title: "Shipping method from admin config",
              code: "shipping-method-code",
            },
          ],
        },
      ],
    },
    shop: {
      metafield: {
        value: JSON.stringify(config),
      },
    },
  };
}

function validConfig(overrides = {}) {
  const config = {
    v: 2,
    kind: "courtyard_checkout_rules.pincode_config",
    pincodeData: {
      records: [
        {
          pc: "PINCODE_FROM_ADMIN_CONFIG",
          ag: "AREA_GROUP_FROM_ADMIN_CONFIG",
          da: "DELIVERY_STATUS_FROM_ADMIN_CONFIG",
        },
      ],
    },
    rules: {
      shippingMethodMappings: [
        {
          id: "standard-map",
          name: "Configured shipping mapping",
          priority: 1,
          matchType: "exact",
          matchValue: "Shipping method from admin config",
          notes: "",
        },
      ],
      productRestrictions: [],
      shippingHideRules: [
        {
          id: "hide-rule",
          name: "Hide rule",
          priority: 1,
          shippingMethodMappingId: "standard-map",
          cutoffRuleSettingId: "",
          productTags: [],
          pincodes: ["PINCODE_FROM_ADMIN_CONFIG"],
          areaGroups: ["AREA_GROUP_FROM_ADMIN_CONFIG"],
          deliveryAvailabilityText: "DELIVERY_STATUS_FROM_ADMIN_CONFIG",
          notes: "",
        },
      ],
      shippingRenameRules: [],
    },
  };

  const { pincodeData, settings, rules, ...ruleOverrides } = overrides;

  return {
    ...config,
    ...(pincodeData ? { pincodeData } : {}),
    ...(settings ? { settings } : {}),
    rules: {
      ...config.rules,
      ...(rules ?? ruleOverrides),
    },
  };
}
