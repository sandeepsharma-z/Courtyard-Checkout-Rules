import { describe, expect, it } from "vitest";

import { run } from "./run";

// Test fixtures only — generic 6-digit values and placeholder names.
const PIN = "100001";
const OTHER_PIN = "200002";
const COD_ID = "gid://shopify/PaymentCustomizationPaymentMethod/1";
const CARD_ID = "gid://shopify/PaymentCustomizationPaymentMethod/2";

function inputWithConfig(config, { zip = PIN, paymentMethods } = {}) {
  return {
    paymentMethods:
      paymentMethods ?? [
        { id: COD_ID, name: "COD_NAME_FROM_ADMIN" },
        { id: CARD_ID, name: "CARD_NAME_FROM_ADMIN" },
      ],
    cart: {
      deliveryGroups: [{ deliveryAddress: { zip } }],
    },
    shop: { metafield: { value: JSON.stringify(config) } },
  };
}

function baseConfig(overrides = {}) {
  return {
    v: 2,
    kind: "courtyard_checkout_rules.pincode_config",
    pincodeData: { records: [] },
    rules: {
      paymentHideRules: [],
      ...overrides,
    },
  };
}

function rule(overrides = {}) {
  return {
    name: "Hide COD",
    priority: 1,
    paymentMethodMappingId: "",
    selectedPaymentMethods: [{ operator: "is", value: "COD_NAME_FROM_ADMIN" }],
    cutoffRuleSettingId: "",
    selectedShippingContains: "",
    productTags: [],
    pincodes: [PIN],
    areaGroups: [],
    deliveryAvailabilityText: "",
    notes: "",
    ...overrides,
  };
}

describe("payment customization", () => {
  it("returns no operations when config is missing", () => {
    expect(run({})).toEqual({ operations: [] });
  });

  it("returns no operations when config is unsupported", () => {
    const input = inputWithConfig({ v: 1, kind: "unsupported" });
    expect(run(input)).toEqual({ operations: [] });
  });

  it("hides the matching payment method and leaves others", () => {
    const config = baseConfig({ paymentHideRules: [rule()] });
    expect(run(inputWithConfig(config, { zip: PIN }))).toEqual({
      operations: [{ hide: { paymentMethodId: COD_ID } }],
    });
  });

  it("does not hide when the pincode is outside the rule", () => {
    const config = baseConfig({ paymentHideRules: [rule()] });
    expect(run(inputWithConfig(config, { zip: OTHER_PIN }))).toEqual({
      operations: [],
    });
  });

  it("skips rules carrying an unsupported cutoff condition", () => {
    const config = baseConfig({
      paymentHideRules: [rule({ cutoffRuleSettingId: "CUTOFF_FROM_ADMIN" })],
    });
    expect(run(inputWithConfig(config, { zip: PIN }))).toEqual({
      operations: [],
    });
  });

  it("ignores selectedShippingContains (always applicable)", () => {
    const config = baseConfig({
      paymentHideRules: [rule({ selectedShippingContains: "EXPRESS_FROM_ADMIN" })],
    });
    expect(run(inputWithConfig(config, { zip: PIN }))).toEqual({
      operations: [{ hide: { paymentMethodId: COD_ID } }],
    });
  });
});
