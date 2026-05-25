# Phase 5 Config Viewer And Simulator

Phase 5 adds read-only admin tooling for the published Shopify metafield snapshot.

## Config Viewer

The config viewer reads the shop-level metafield:

- Namespace: `courtyard_checkout_rules`
- Key: `published_config`

It parses and validates the schema-versioned JSON snapshot, shows summary fields, reports errors or warnings, and previews the first pincode records.

## Simulator

The simulator accepts admin-only test inputs:

- Pincode.
- Cart total.
- Product tags.
- Selected shipping method.
- Selected payment method.
- Current time.

In this phase, the simulator only performs pincode lookup from the published snapshot. Other inputs are accepted and echoed for future rule planning.

## Non-Scope

This phase does not add Shopify Functions, checkout rule execution, shipping customization, payment customization, validation blocking, or published config writes. Checkout behavior is unchanged.
