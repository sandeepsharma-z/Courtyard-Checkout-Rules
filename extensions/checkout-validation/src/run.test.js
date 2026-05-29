import { describe, expect, test } from "vitest";
import { run } from "./run";

const baseConfig = {
  v: 2,
  kind: "courtyard_checkout_rules.pincode_config",
  pincodeData: {
    records: [{ pc: "PINCODE_PLACEHOLDER", ag: "AREA_GROUP_PLACEHOLDER" }],
  },
  rules: {
    productRestrictions: [],
  },
};

function inputWithConfig(config, zip = "PINCODE_PLACEHOLDER") {
  return {
    cart: {
      deliveryGroups: [
        {
          deliveryAddress: { zip },
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

describe("checkout validation function", () => {
  test("returns no operations when config is missing", () => {
    expect(run({ cart: {}, shop: {} })).toEqual({ operations: [] });
  });

  test("returns no operations when config is invalid", () => {
    expect(
      run({
        cart: {},
        shop: { metafield: { value: "{invalid-json" } },
      }),
    ).toEqual({ operations: [] });
  });

  test("blocks unknown pincodes when admin setting is enabled", () => {
    const config = {
      ...baseConfig,
      settings: {
        blockUnknownPincode: true,
        unknownPincodeMessage: "UNKNOWN_PINCODE_MESSAGE_FROM_ADMIN",
      },
    };

    expect(run(inputWithConfig(config, "654321"))).toEqual({
      operations: [
        {
          validationAdd: {
            errors: [
              {
                message: "UNKNOWN_PINCODE_MESSAGE_FROM_ADMIN",
                target: "$.cart.deliveryGroups[0].deliveryAddress.zip",
              },
            ],
          },
        },
      ],
    });
  });

  test("adds a validation operation for a matching pincode rule with configured message", () => {
    const config = {
      ...baseConfig,
      rules: {
        productRestrictions: [
          {
            priority: "10",
            pincodes: ["PINCODE_PLACEHOLDER"],
            validationMessage: "VALIDATION_MESSAGE_PLACEHOLDER",
          },
        ],
      },
    };

    expect(run(inputWithConfig(config))).toEqual({
      operations: [
        {
          validationAdd: {
            errors: [
              {
                message: "VALIDATION_MESSAGE_PLACEHOLDER",
                target: "$.cart.deliveryGroups[0].deliveryAddress.zip",
              },
            ],
          },
        },
      ],
    });
  });

  test("blocks pincode when admin-configured delivery text matches", () => {
    const config = {
      ...baseConfig,
      pincodeData: {
        records: [
          {
            pc: "PINCODE_PLACEHOLDER",
            sd: "DELIVERY_STATUS_TEXT_FROM_ADMIN",
          },
        ],
      },
      settings: {
        blockMatchingDeliveryText: true,
        deliveryBlockMatchText: "DELIVERY_STATUS_TEXT",
        deliveryBlockMessage: "DELIVERY_BLOCK_MESSAGE_FROM_ADMIN",
      },
    };

    expect(run(inputWithConfig(config))).toEqual({
      operations: [
        {
          validationAdd: {
            errors: [
              {
                message: "DELIVERY_BLOCK_MESSAGE_FROM_ADMIN",
                target: "$.cart.deliveryGroups[0].deliveryAddress.zip",
              },
            ],
          },
        },
      ],
    });
  });

  test("adds a validation operation for product-tag rules when tag input is unavailable", () => {
    const config = {
      ...baseConfig,
      rules: {
        productRestrictions: [
          {
            priority: "10",
            pincodes: ["PINCODE_PLACEHOLDER"],
            productTags: ["PRODUCT_TAG_PLACEHOLDER"],
            validationMessage: "VALIDATION_MESSAGE_PLACEHOLDER",
          },
        ],
      },
    };

    expect(run(inputWithConfig(config))).toEqual({
      operations: [
        {
          validationAdd: {
            errors: [
              {
                message: "VALIDATION_MESSAGE_PLACEHOLDER",
                target: "$.cart.deliveryGroups[0].deliveryAddress.zip",
              },
            ],
          },
        },
      ],
    });
  });

  test("matches pincodes from pasted or concatenated pincode text", () => {
    const config = {
      ...baseConfig,
      rules: {
        productRestrictions: [
          {
            priority: "10",
            pincodes: ["PINCODE_PLACEHOLDER122506 122507"],
            validationMessage: "VALIDATION_MESSAGE_PLACEHOLDER",
          },
        ],
      },
    };

    expect(run(inputWithConfig(config, "122506"))).toEqual({
      operations: [
        {
          validationAdd: {
            errors: [
              {
                message: "VALIDATION_MESSAGE_PLACEHOLDER",
                target: "$.cart.deliveryGroups[0].deliveryAddress.zip",
              },
            ],
          },
        },
      ],
    });
  });

  test("returns no operations when product tag input is available but does not match", () => {
    const config = {
      ...baseConfig,
      rules: {
        productRestrictions: [
          {
            priority: "10",
            pincodes: ["PINCODE_PLACEHOLDER"],
            productTags: ["PRODUCT_TAG_PLACEHOLDER"],
            validationMessage: "VALIDATION_MESSAGE_PLACEHOLDER",
          },
        ],
      },
    };

    const input = inputWithConfig(config);
    input.cart.lines = [
      {
        merchandise: {
          product: {
            tags: ["OTHER_PRODUCT_TAG_PLACEHOLDER"],
          },
        },
      },
    ];

    expect(run(input)).toEqual({ operations: [] });
  });
});
