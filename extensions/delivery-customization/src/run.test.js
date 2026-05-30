import { describe, expect, it } from "vitest";

import { run } from "./run";

// Test fixtures only — generic 6-digit values, not real business pincodes.
const PIN = "100001";

function inputWithConfig(config, zip = PIN, options, cartTime) {
  const cart = {
    deliveryGroups: [
      {
        deliveryAddress: { zip },
        deliveryOptions:
          options ?? [
            { handle: "standard-shipping", title: "STANDARD_FROM_ADMIN", code: "" },
          ],
      },
    ],
  };
  if (cartTime !== undefined) {
    cart.timeAttr = { value: cartTime };
  }
  return {
    shop: { metafield: { value: JSON.stringify(config) } },
    cart,
  };
}

function baseConfig(overrides = {}) {
  return {
    v: 2,
    kind: "courtyard_checkout_rules.pincode_config",
    pincodeData: { records: [] },
    rules: {
      shippingHideRules: [],
      shippingRenameRules: [],
      ...overrides,
    },
  };
}

describe("delivery customization", () => {
  it("returns no operations when config is missing", () => {
    expect(run({})).toEqual({ operations: [] });
  });

  it("returns no operations when config is unsupported", () => {
    const input = inputWithConfig({ v: 1, kind: "unsupported" });
    expect(run(input)).toEqual({ operations: [] });
  });

  it("show mode hides every option not in the allowlist", () => {
    const config = baseConfig({
      shippingHideRules: [
        {
          name: "Allowlist",
          methodMatchMode: "show",
          selectedShippingMethods: [
            { operator: "is", value: "KEEP_METHOD_FROM_ADMIN" },
          ],
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          cutoffRuleSettingId: "",
        },
      ],
    });
    const options = [
      { handle: "keep", title: "KEEP_METHOD_FROM_ADMIN", code: "" },
      { handle: "drop", title: "OTHER_METHOD_FROM_ADMIN", code: "" },
    ];
    expect(run(inputWithConfig(config, PIN, options))).toEqual({
      operations: [{ hide: { deliveryOptionHandle: "drop" } }],
    });
  });

  it("hide mode hides matching options", () => {
    const config = baseConfig({
      shippingHideRules: [
        {
          name: "Blocklist",
          methodMatchMode: "hide",
          selectedShippingMethods: [
            { operator: "contains", value: "SLOW_METHOD_FROM_ADMIN" },
          ],
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          cutoffRuleSettingId: "",
        },
      ],
    });
    const options = [
      { handle: "fast", title: "FAST_METHOD_FROM_ADMIN", code: "" },
      { handle: "slow", title: "SLOW_METHOD_FROM_ADMIN extra", code: "" },
    ];
    expect(run(inputWithConfig(config, PIN, options))).toEqual({
      operations: [{ hide: { deliveryOptionHandle: "slow" } }],
    });
  });

  it("skips rules that carry an unsupported cutoff condition", () => {
    const config = baseConfig({
      shippingHideRules: [
        {
          name: "Cutoff rule",
          methodMatchMode: "show",
          selectedShippingMethods: [
            { operator: "is", value: "KEEP_METHOD_FROM_ADMIN" },
          ],
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          cutoffRuleSettingId: "CUTOFF_FROM_ADMIN",
        },
      ],
    });
    const options = [
      { handle: "keep", title: "KEEP_METHOD_FROM_ADMIN", code: "" },
      { handle: "other", title: "OTHER_METHOD_FROM_ADMIN", code: "" },
    ];
    // Cutoff rule is skipped → no allowlist → nothing hidden.
    expect(run(inputWithConfig(config, PIN, options))).toEqual({ operations: [] });
  });

  // Cutoff (time-of-day) support. A hide rule with methodMatchMode "show"
  // builds an allowlist, so when the cutoff applies every other method is
  // hidden; when the cutoff does not apply the rule is skipped and nothing
  // is hidden.
  function cutoffConfig() {
    return baseConfig({
      shippingHideRules: [
        {
          name: "After-cutoff allowlist",
          methodMatchMode: "show",
          selectedShippingMethods: [
            { operator: "is", value: "KEEP_METHOD_FROM_ADMIN" },
          ],
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
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
    });
  }

  const cutoffOptions = [
    { handle: "keep", title: "KEEP_METHOD_FROM_ADMIN", code: "" },
    { handle: "other", title: "OTHER_METHOD_FROM_ADMIN", code: "" },
  ];

  it("applies an after-cutoff rule when the cart time is at/after the cutoff", () => {
    expect(
      run(inputWithConfig(cutoffConfig(), PIN, cutoffOptions, "16:00")),
    ).toEqual({ operations: [{ hide: { deliveryOptionHandle: "other" } }] });
  });

  it("treats the cutoff boundary (equal time) as 'after' applying", () => {
    expect(
      run(inputWithConfig(cutoffConfig(), PIN, cutoffOptions, "15:30")),
    ).toEqual({ operations: [{ hide: { deliveryOptionHandle: "other" } }] });
  });

  it("does not apply an after-cutoff rule before the cutoff time", () => {
    expect(
      run(inputWithConfig(cutoffConfig(), PIN, cutoffOptions, "10:00")),
    ).toEqual({ operations: [] });
  });

  it("fails safe: cutoff rule does not apply when cart time is missing", () => {
    expect(run(inputWithConfig(cutoffConfig(), PIN, cutoffOptions))).toEqual({
      operations: [],
    });
  });

  it("fails safe: cutoff rule does not apply when cart time is unparseable", () => {
    expect(
      run(inputWithConfig(cutoffConfig(), PIN, cutoffOptions, "not-a-time")),
    ).toEqual({ operations: [] });
  });

  it("supports a before-cutoff rule (applies before the cutoff time)", () => {
    const config = baseConfig({
      shippingHideRules: [
        {
          name: "Before-cutoff allowlist",
          methodMatchMode: "show",
          selectedShippingMethods: [
            { operator: "is", value: "KEEP_METHOD_FROM_ADMIN" },
          ],
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          cutoffRuleSettingId: "CUTOFF_2",
        },
      ],
      cutoffSettings: [
        {
          id: "CUTOFF_2",
          name: "Before 03:30 PM",
          priority: 10,
          timeValue: "03:30 PM",
          timezone: "Asia/Kolkata",
          matchMode: "before",
          notes: "",
        },
      ],
    });
    // 10:00 is before 15:30 → applies (allowlist hides "other").
    expect(run(inputWithConfig(config, PIN, cutoffOptions, "10:00"))).toEqual({
      operations: [{ hide: { deliveryOptionHandle: "other" } }],
    });
    // 16:00 is after 15:30 → does not apply.
    expect(run(inputWithConfig(config, PIN, cutoffOptions, "16:00"))).toEqual({
      operations: [],
    });
  });

  it("a non-cutoff rule produces identical output regardless of cart time", () => {
    const config = baseConfig({
      shippingHideRules: [
        {
          name: "Allowlist",
          methodMatchMode: "show",
          selectedShippingMethods: [
            { operator: "is", value: "KEEP_METHOD_FROM_ADMIN" },
          ],
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          cutoffRuleSettingId: "",
        },
      ],
    });
    const expected = { operations: [{ hide: { deliveryOptionHandle: "other" } }] };
    // Same result with no cart time, a "before" time, and an "after" time.
    expect(run(inputWithConfig(config, PIN, cutoffOptions))).toEqual(expected);
    expect(run(inputWithConfig(config, PIN, cutoffOptions, "10:00"))).toEqual(
      expected,
    );
    expect(run(inputWithConfig(config, PIN, cutoffOptions, "23:59"))).toEqual(
      expected,
    );
  });

  it("hides every option for an unknown pincode when blocking is enabled", () => {
    const config = {
      ...baseConfig(),
      settings: { blockUnknownPincode: true, unknownPincodeMessage: "X" },
    };
    const options = [
      { handle: "a", title: "A", code: "" },
      { handle: "b", title: "B", code: "" },
    ];
    // "999999" is not in pincodeData.records → unserviceable → hide all.
    expect(run(inputWithConfig(config, "999999", options))).toEqual({
      operations: [
        { hide: { deliveryOptionHandle: "a" } },
        { hide: { deliveryOptionHandle: "b" } },
      ],
    });
  });

  it("does not hide for a known pincode even when blocking is enabled", () => {
    const config = {
      ...baseConfig(),
      pincodeData: { records: [{ pc: PIN, ag: "", da: "" }] },
      settings: { blockUnknownPincode: true, unknownPincodeMessage: "X" },
    };
    const options = [{ handle: "a", title: "A", code: "" }];
    expect(run(inputWithConfig(config, PIN, options))).toEqual({ operations: [] });
  });

  it("hides every option when a product restriction lists the pincode (product tags ignored)", () => {
    const config = baseConfig({
      productRestrictions: [
        {
          name: "Blocked area",
          pincodes: [PIN],
          areaGroups: [],
          // A product tag must NOT stop shipping from being hidden: Shopify
          // Functions cannot read tags, so the validation block applies anyway.
          productTags: ["FRESH_FROM_ADMIN"],
          deliveryAvailabilityText: "",
          validationMessage: "Not available",
        },
      ],
    });
    const options = [
      { handle: "a", title: "A", code: "" },
      { handle: "b", title: "B", code: "" },
    ];
    expect(run(inputWithConfig(config, PIN, options))).toEqual({
      operations: [
        { hide: { deliveryOptionHandle: "a" } },
        { hide: { deliveryOptionHandle: "b" } },
      ],
    });
  });

  it("does not hide when a restriction matches the pincode but carries no message", () => {
    const config = baseConfig({
      productRestrictions: [
        {
          name: "No message",
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          validationMessage: "",
        },
      ],
    });
    const options = [{ handle: "a", title: "A", code: "" }];
    expect(run(inputWithConfig(config, PIN, options))).toEqual({ operations: [] });
  });

  it("does not hide when a restriction does not list this pincode", () => {
    const config = baseConfig({
      productRestrictions: [
        {
          name: "Other area",
          pincodes: ["222222"],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          validationMessage: "Not available",
        },
      ],
    });
    const options = [{ handle: "a", title: "A", code: "" }];
    expect(run(inputWithConfig(config, PIN, options))).toEqual({ operations: [] });
  });

  it("does not act on a pincode outside the rule", () => {
    const config = baseConfig({
      shippingHideRules: [
        {
          name: "Allowlist",
          methodMatchMode: "show",
          selectedShippingMethods: [
            { operator: "is", value: "KEEP_METHOD_FROM_ADMIN" },
          ],
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          cutoffRuleSettingId: "",
        },
      ],
    });
    expect(run(inputWithConfig(config, "999999"))).toEqual({ operations: [] });
  });
});
