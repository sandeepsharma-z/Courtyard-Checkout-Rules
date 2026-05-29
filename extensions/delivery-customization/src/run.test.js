import { describe, expect, it } from "vitest";

import { run } from "./run";

// Test fixtures only — generic 6-digit values, not real business pincodes.
const PIN = "100001";

function inputWithConfig(config, zip = PIN, options) {
  return {
    shop: { metafield: { value: JSON.stringify(config) } },
    cart: {
      deliveryGroups: [
        {
          deliveryAddress: { zip },
          deliveryOptions:
            options ?? [
              { handle: "standard-shipping", title: "STANDARD_FROM_ADMIN", code: "" },
            ],
        },
      ],
    },
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

  it("renames a matching option from published rename rules", () => {
    const config = baseConfig({
      shippingRenameRules: [
        {
          name: "Rename rule",
          selectedShippingMethods: [
            {
              operator: "is",
              matchValue: "SOURCE_METHOD_FROM_ADMIN",
              newLabel: "RENAMED_METHOD_FROM_ADMIN",
            },
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
      { handle: "source", title: "SOURCE_METHOD_FROM_ADMIN", code: "" },
    ];

    expect(run(inputWithConfig(config, PIN, options))).toEqual({
      operations: [
        {
          rename: {
            deliveryOptionHandle: "source",
            title: "RENAMED_METHOD_FROM_ADMIN",
          },
        },
      ],
    });
  });

  it("hides the original option when the renamed label already exists", () => {
    const config = baseConfig({
      shippingRenameRules: [
        {
          name: "Rename duplicate source",
          selectedShippingMethods: [
            {
              operator: "is",
              matchValue: "SOURCE_METHOD_FROM_ADMIN",
              newLabel: "RENAMED_METHOD_FROM_ADMIN",
            },
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
      { handle: "renamed", title: "RENAMED_METHOD_FROM_ADMIN", code: "" },
      { handle: "source", title: "SOURCE_METHOD_FROM_ADMIN", code: "" },
    ];

    expect(run(inputWithConfig(config, PIN, options))).toEqual({
      operations: [{ hide: { deliveryOptionHandle: "source" } }],
    });
  });

  it("uses show mode with renamed labels to remove default methods", () => {
    const config = baseConfig({
      shippingHideRules: [
        {
          name: "Only show renamed local method",
          methodMatchMode: "show",
          selectedShippingMethods: [
            { operator: "is", value: "RENAMED_METHOD_FROM_ADMIN" },
          ],
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          cutoffRuleSettingId: "",
        },
      ],
      shippingRenameRules: [
        {
          name: "Rename source method",
          selectedShippingMethods: [
            {
              operator: "is",
              matchValue: "SOURCE_METHOD_FROM_ADMIN",
              newLabel: "RENAMED_METHOD_FROM_ADMIN",
            },
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
      { handle: "source", title: "SOURCE_METHOD_FROM_ADMIN", code: "" },
      { handle: "other", title: "OTHER_METHOD_FROM_ADMIN", code: "" },
    ];

    expect(run(inputWithConfig(config, PIN, options))).toEqual({
      operations: [
        { hide: { deliveryOptionHandle: "other" } },
        {
          rename: {
            deliveryOptionHandle: "source",
            title: "RENAMED_METHOD_FROM_ADMIN",
          },
        },
      ],
    });
  });

  it("uses matching rename rules as an implicit allowlist", () => {
    const config = baseConfig({
      shippingRenameRules: [
        {
          name: "Rename source method",
          selectedShippingMethods: [
            {
              operator: "is",
              matchValue: "SOURCE_METHOD_FROM_ADMIN",
              newLabel: "RENAMED_METHOD_FROM_ADMIN",
            },
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
      { handle: "source", title: "SOURCE_METHOD_FROM_ADMIN", code: "" },
      { handle: "default", title: "DEFAULT_METHOD_FROM_SHOPIFY", code: "" },
    ];

    expect(run(inputWithConfig(config, PIN, options))).toEqual({
      operations: [
        { hide: { deliveryOptionHandle: "default" } },
        {
          rename: {
            deliveryOptionHandle: "source",
            title: "RENAMED_METHOD_FROM_ADMIN",
          },
        },
      ],
    });
  });

  it("matches admin-entered partial shipping method names for rename allowlists", () => {
    const config = baseConfig({
      shippingRenameRules: [
        {
          name: "Rename partial method title",
          selectedShippingMethods: [
            {
              operator: "is",
              matchValue: "SOURCE_METHOD",
              newLabel: "RENAMED_METHOD_FROM_ADMIN",
            },
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
      { handle: "source", title: "SOURCE_METHOD_FROM_ADMIN", code: "" },
      { handle: "default", title: "DEFAULT_METHOD_FROM_SHOPIFY", code: "" },
    ];

    expect(run(inputWithConfig(config, PIN, options))).toEqual({
      operations: [
        { hide: { deliveryOptionHandle: "default" } },
        {
          rename: {
            deliveryOptionHandle: "source",
            title: "RENAMED_METHOD_FROM_ADMIN",
          },
        },
      ],
    });
  });

  it("keeps hide priority over rename for the same option", () => {
    const config = baseConfig({
      shippingHideRules: [
        {
          name: "Hide source",
          methodMatchMode: "hide",
          selectedShippingMethods: [
            { operator: "is", value: "SOURCE_METHOD_FROM_ADMIN" },
          ],
          pincodes: [PIN],
          areaGroups: [],
          productTags: [],
          deliveryAvailabilityText: "",
          cutoffRuleSettingId: "",
        },
      ],
      shippingRenameRules: [
        {
          name: "Rename source",
          selectedShippingMethods: [
            {
              operator: "is",
              matchValue: "SOURCE_METHOD_FROM_ADMIN",
              newLabel: "RENAMED_METHOD_FROM_ADMIN",
            },
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
      { handle: "source", title: "SOURCE_METHOD_FROM_ADMIN", code: "" },
    ];

    expect(run(inputWithConfig(config, PIN, options))).toEqual({
      operations: [{ hide: { deliveryOptionHandle: "source" } }],
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
