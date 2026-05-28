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
                target:
                  "$.cart.deliveryGroups[0].deliveryAddress.postalCode",
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
                target:
                  "$.cart.deliveryGroups[0].deliveryAddress.postalCode",
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
