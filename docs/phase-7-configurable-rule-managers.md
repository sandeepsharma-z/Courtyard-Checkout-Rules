# Phase 7 Configurable Rule Managers

Phase 7 adds local admin-managed rule configuration for preview and future checkout behavior.

## Added Managers

- Product restriction rules.
- Shipping method mappings.
- Payment method mappings.
- Shipping hide rules.
- Shipping rename rules.
- Payment hide rules.
- Cutoff/time settings.

Each rule or mapping supports:

- Enabled status.
- Priority.
- Notes.
- Created and updated timestamps.

## Storage

Rules are stored locally in Prisma using flexible JSON-string fields for condition lists. This keeps the rule model adjustable while BSure parity details are still being confirmed.

## Published Snapshot

The published config schema is now version 2. Only enabled rules and mappings are included in the Shopify metafield snapshot. Disabled rules remain local only.

## Simulator

The simulator evaluates published v2 rules for preview only:

- Product restriction rule matches.
- Shipping hide rule matches.
- Shipping rename rule matches.
- Payment hide rule matches.
- Cutoff setting matches.

Shipping hide matches take priority over shipping rename matches.

## No Checkout Behavior

This phase does not add Shopify Functions, checkout validation, live shipping method changes, or live payment method changes.

## No-Hardcoding Rule

Real charges, pincodes, cutoff times, product tags, shipping method names, payment method names, and labels must come from imported data, admin-created rules, or admin-entered simulator inputs.
