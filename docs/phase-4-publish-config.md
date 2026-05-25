# Phase 4 Publish Config

Phase 4 publishes approved local pincode configuration into Shopify-side storage without changing checkout behavior.

## Current Strategy

This phase uses a single shop-level JSON metafield as the publish layer:

- Namespace: `courtyard_checkout_rules`
- Key: `published_config`
- Type: `json`
- Owner: shop

The payload is compact and schema-versioned so future Shopify Functions can read it safely.

## Size Guard

The app measures the generated JSON payload size before publishing. If the payload is too large for the current single-metafield strategy, the publish is blocked. The admin page shows the exact payload size and recommends a future chunked configuration strategy.

This project must not assume one JSON metafield will always be enough. Future phases may need chunked metafields, metaobjects, or another Shopify-side configuration layout for large datasets.

## No Checkout Behavior

This phase does not add Shopify Functions, checkout validation, shipping customization, payment customization, or checkout rule execution.

## Rollback

Each publish writes local history to Prisma. Previous snapshots can be republished to the same Shopify metafield.

## No-Hardcoding Rule

All operational values remain imported or admin-configured strings. The publish layer must not hardcode real charges, pincodes, cutoff times, product tags, shipping method names, payment method names, or labels.
