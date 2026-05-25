# Courtyard Checkout Rules

Documentation scaffold for a custom Shopify checkout rules app for Courtyard Farms.

This project is intended to replace the paid BSure Checkout Rules app with a custom Shopify app that manages checkout behavior from configurable rule data.

## Current Phase

This repository is currently documentation-only. It does not contain Shopify app code, Shopify Function code, package manifests, dependencies, or generated extension files.

## Goal

The future app should support:

- Pincode-wise delivery rules.
- Product availability validation based on configured product tags.
- Shipping method hide rules.
- Shipping method rename rules.
- Payment method hide rules.
- CSV or PDF-converted delivery data imports.
- Manual admin configuration for values that are not imported.
- Rule simulation before publishing changes.
- Shopify Functions for checkout-time behavior.

## No-Hardcoding Rule

Operational values must not be hardcoded in app logic. This includes delivery charges, pincode lists, cutoff times, product tag values, shipping method names, payment method names, and customer-facing delivery labels.

All real values must come from imported data or admin configuration, then be stored in Shopify-side configuration such as metafields or metaobjects so Shopify Functions can read them at checkout time.

## Future Checkout Pipeline

1. Customer enters checkout.
2. Customer enters shipping address and pincode.
3. App configuration is evaluated against the pincode, cart products, product tags, and timing conditions.
4. Shopify Functions apply checkout behavior:
   - Hide invalid shipping methods.
   - Rename configured shipping methods.
   - Hide invalid payment methods.
   - Block checkout when validation rules fail.
5. Customer sees only valid checkout options.

## Key Documentation

- [Current BSure Rules](docs/bsure-current-rules.md)
- [Checkout Pipeline](docs/checkout-pipeline.md)
- [Data Model](docs/data-model.md)
- [Development Plan](docs/development-plan.md)
- [Import Strategy](docs/import-strategy.md)
- [Rule Engine Notes](docs/rule-engine-notes.md)
- [Testing Checklist](docs/testing-checklist.md)

