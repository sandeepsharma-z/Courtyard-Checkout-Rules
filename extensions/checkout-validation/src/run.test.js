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

function inputWithConfig(config, zip = "PINCODE_PLACEHOLDER", cartTime) {
  const cart = {
    deliveryGroups: [
      {
        deliveryAddress: { zip },
      },
    ],
  };
  if (cartTime !== undefined) {
    cart.attribute = { value: cartTime };
  }
  return {
    cart,
    shop: {
      metafield: {
        value: JSON.stringify(config),
      },
    },
  };
}

function cutoffRestrictionConfig() {
  return {
    ...baseConfig,
    rules: {
      productRestrictions: [
        {
          priority: "10",
          pincodes: ["PINCODE_PLACEHOLDER"],
          validationMessage: "VALIDATION_MESSAGE_PLACEHOLDER",
          cutoffRuleSettingId: "CUTOFF_1",
        },
      ],
      cutoffSettings: [
        {
          id: "CUTOFF_1",
          name: "After 15:30",
          priority: 10,
          timeValue: "15:30",
          timezone: "Asia/Kolkata",
          matchMode: "after",
          notes: "",
        },
      ],
    },
  };
}

const cutoffError = {
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
};

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

  test("applies an after-cutoff restriction when cart time is at/after the cutoff", () => {
    expect(
      run(inputWithConfig(cutoffRestrictionConfig(), "PINCODE_PLACEHOLDER", "16:00")),
    ).toEqual(cutoffError);
  });

  test("applies an after-cutoff restriction at the boundary (equal time)", () => {
    expect(
      run(inputWithConfig(cutoffRestrictionConfig(), "PINCODE_PLACEHOLDER", "15:30")),
    ).toEqual(cutoffError);
  });

  test("does not apply an after-cutoff restriction before the cutoff time", () => {
    expect(
      run(inputWithConfig(cutoffRestrictionConfig(), "PINCODE_PLACEHOLDER", "10:00")),
    ).toEqual({ operations: [] });
  });

  test("fails safe: cutoff restriction does not block when cart time is missing", () => {
    expect(run(inputWithConfig(cutoffRestrictionConfig()))).toEqual({
      operations: [],
    });
  });

  test("fails safe: cutoff restriction does not block when cart time is unparseable", () => {
    expect(
      run(inputWithConfig(cutoffRestrictionConfig(), "PINCODE_PLACEHOLDER", "nope")),
    ).toEqual({ operations: [] });
  });

  test("a non-cutoff restriction blocks identically regardless of cart time", () => {
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
    expect(run(inputWithConfig(config))).toEqual(cutoffError);
    expect(run(inputWithConfig(config, "PINCODE_PLACEHOLDER", "10:00"))).toEqual(
      cutoffError,
    );
    expect(run(inputWithConfig(config, "PINCODE_PLACEHOLDER", "23:59"))).toEqual(
      cutoffError,
    );
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
