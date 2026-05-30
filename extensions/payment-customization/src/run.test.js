import { describe, expect, it } from "vitest";

import { run } from "./run";

// Test fixtures only — generic 6-digit values and placeholder names.
const PIN = "100001";
const OTHER_PIN = "200002";
const COD_ID = "gid://shopify/PaymentCustomizationPaymentMethod/1";
const CARD_ID = "gid://shopify/PaymentCustomizationPaymentMethod/2";

function inputWithConfig(config, { zip = PIN, paymentMethods, shippingTitle } = {}) {
  const group = { deliveryAddress: { zip } };
  if (shippingTitle !== undefined) {
    group.selectedDeliveryOption = { title: shippingTitle };
  }
  return {
    paymentMethods:
      paymentMethods ?? [
        { id: COD_ID, name: "COD_NAME_FROM_ADMIN" },
        { id: CARD_ID, name: "CARD_NAME_FROM_ADMIN" },
      ],
    cart: {
      deliveryGroups: [group],
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

  it("applies a selectedShippingContains rule only when a selected option matches", () => {
    const config = baseConfig({
      paymentHideRules: [rule({ selectedShippingContains: "Same Day Delivery" })],
    });
    // Matching selected shipping option → hide.
    expect(
      run(
        inputWithConfig(config, {
          zip: PIN,
          shippingTitle: "Same Day Delivery (Evening Slot 4PM-8PM)",
        }),
      ),
    ).toEqual({ operations: [{ hide: { paymentMethodId: COD_ID } }] });
    // Different selected option → does not hide.
    expect(
      run(
        inputWithConfig(config, {
          zip: PIN,
          shippingTitle: "Cold Chain Delivery Tomorrow",
        }),
      ),
    ).toEqual({ operations: [] });
    // No selected option yet → does not hide (fail safe).
    expect(run(inputWithConfig(config, { zip: PIN }))).toEqual({ operations: [] });
  });

  it("matches pincodes with a wildcard pattern", () => {
    const config = baseConfig({
      paymentHideRules: [rule({ pincodes: ["11*"] })],
    });
    expect(run(inputWithConfig(config, { zip: "110082" }))).toEqual({
      operations: [{ hide: { paymentMethodId: COD_ID } }],
    });
    expect(run(inputWithConfig(config, { zip: "201010" }))).toEqual({
      operations: [],
    });
  });

  it("supports not_has mode: hides when zip is outside the listed patterns", () => {
    const config = baseConfig({
      paymentHideRules: [
        rule({ pincodeMatchMode: "not_has", pincodes: ["11*", "12*", "20*"] }),
      ],
    });
    // Outside 11*/12*/20* → hide COD.
    expect(run(inputWithConfig(config, { zip: "560001" }))).toEqual({
      operations: [{ hide: { paymentMethodId: COD_ID } }],
    });
    // Inside 11* → do not hide.
    expect(run(inputWithConfig(config, { zip: "110001" }))).toEqual({
      operations: [],
    });
  });

  it("does not hide for a not_has rule when the zip is unknown (fail safe)", () => {
    const config = baseConfig({
      paymentHideRules: [rule({ pincodeMatchMode: "not_has", pincodes: ["11*"] })],
    });
    expect(run(inputWithConfig(config, { zip: "" }))).toEqual({ operations: [] });
  });
});
