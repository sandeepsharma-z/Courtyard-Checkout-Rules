# Development Plan

## Phase 1: Documentation Scaffold

- Create project documentation and folder structure.
- Capture current BSure rule categories.
- Define no-hardcoding policy.
- Document expected data import fields.

## Phase 2: Current Rule Discovery

- Collect BSure screenshots, exports, and store shipping/payment method settings.
- Record observations in `notes/bsure-screenshot-observations.md`.
- Identify all rule groups, method mappings, validation messages, and imported delivery data sources.

## Phase 3: Configuration Model

- Finalize Shopify metafield/metaobject structures.
- Define admin-managed records for pincode groups, product restrictions, shipping mappings, payment mappings, cutoff settings, and validation messages.
- Define publish/draft behavior for rule changes.

## Phase 4: Importer

- Build CSV import flow.
- Support PDF-converted tabular data after conversion into a structured format.
- Validate required columns before saving.
- Provide preview, error reporting, and approval before publishing configuration.

## Phase 5: Admin Dashboard

- Build configuration screens for:
  - Pincode groups.
  - Product restrictions.
  - Cutoff settings.
  - Shipping method mappings.
  - Shipping hide rules.
  - Shipping rename rules.
  - Payment method rules.
  - Validation rules.
  - Rule simulator.

## Phase 6: Shopify Functions

- Implement delivery customization for shipping hide and rename.
- Implement payment customization for payment method hide.
- Implement cart/checkout validation for product and pincode blocks.
- Ensure Functions read Shopify-side configuration only.

## Phase 7: Testing And Migration

- Compare custom app behavior against current BSure configuration.
- Test sample carts, pincodes, tags, shipping methods, payment methods, and cutoff scenarios.
- Run simulator cases before enabling production behavior.
- Keep BSure available until parity is confirmed.

