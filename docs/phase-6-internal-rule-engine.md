# Phase 6 Internal Rule Engine

Phase 6 adds a pure TypeScript rule engine for admin-only simulation.

## Scope

- Evaluate published config snapshot data.
- Match pincode from simulator input.
- Preview imported/admin-configured delivery availability fields.
- Accept product tag, shipping method, payment method, cart total, and current time test inputs.
- Show preview-only future-ready sections for product restrictions, shipping hide/rename, payment hide, and cutoff behavior.

## Portability

The engine is designed to be portable to future Shopify Functions:

- No Prisma dependency.
- No Shopify Admin API dependency.
- No React dependency.
- No environment variable dependency.
- Plain JSON-compatible inputs and outputs.

## No Checkout Behavior

This phase does not add Shopify Functions, checkout validation, live shipping customization, live payment customization, or any checkout behavior changes.

## No-Hardcoding Rule

Operational values must come only from the published Shopify config snapshot or admin-entered simulator inputs. The engine must not hardcode real charges, pincodes, cutoff times, product tags, shipping method names, payment method names, or labels.
