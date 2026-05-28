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

  it("hides all shipping methods when a product restriction matches the pincode", () => {
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

function inputWithConfig(config) {
  return {
    cart: {
      deliveryGroups: [
        {
          deliveryAddress: {
            zip: "PINCODE_FROM_ADMIN_CONFIG",
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
  return {
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
      ...overrides,
    },
  };
}
