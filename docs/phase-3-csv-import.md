# Phase 3 CSV Import

Phase 3 adds local CSV import storage for pincode-wise delivery data.

## Scope

- Upload CSV files from the Shopify admin app.
- Validate required headers.
- Parse row values as strings.
- Store valid, invalid, and duplicate rows for review.
- Allow admin approval of an import batch.
- Mark approved valid rows as the current local configurable pincode dataset.

## Storage

This phase uses Prisma with local SQLite storage. It does not publish to Shopify metaobjects or metafields yet.

## No Checkout Behavior

This phase does not add Shopify Functions or checkout rule execution. Imported values are stored as configurable data only.

## No-Hardcoding Rule

Charges, pincodes, cutoff times, product tags, shipping method names, payment method names, and labels must remain imported or admin-configured data. They must not be interpreted as checkout logic in this phase.
