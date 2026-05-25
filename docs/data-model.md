# Data Model

This document describes the planned configuration model. Names are conceptual and may change during implementation.

## Pincode Record

Represents one imported or manually managed delivery row.

Expected fields:

- `state`
- `district`
- `pincode`
- `location_name`
- `area_group`
- `delivery_availability`
- `same_day_delivery_rule`
- `next_day_delivery_rule`
- `product_availability_rule`
- `remarks`
- `charges_pricing_text`
- `updated_same_day_rule`
- `updated_next_day_rule`

Real pincode and pricing values must come from imports or admin configuration.

## Pincode Group

Groups pincodes or imported area classifications for reuse in rules.

Examples of group purpose:

- Delivery availability group.
- Restricted product group.
- Same-day delivery group.
- Next-day delivery group.
- Custom manually configured group.

Group membership must be data-driven.

## Product Tag Restriction

Defines how configured product tags interact with pincode groups.

Fields should include:

- Rule name.
- Enabled status.
- Configured product tag references.
- Pincode group references.
- Configurable customer-facing error message.

Product tag values must be admin-configured or imported, not hardcoded.

## Shipping Method Mapping

Maps actual Shopify shipping method names into stable admin-managed records.

Fields should include:

- Internal mapping ID.
- Display name for admins.
- Shopify method match value.
- Match type, such as exact or contains.
- Enabled status.

## Shipping Hide Rule

Defines when a mapped shipping method should be hidden.

Conditions may include:

- Pincode group.
- Area group.
- Product tag condition.
- Cutoff setting.
- Cart or customer condition if needed.

## Shipping Rename Rule

Defines when a mapped shipping method should be renamed.

Fields should include:

- Source shipping method mapping.
- New display label from imported data or admin configuration.
- Conditions that trigger the rename.
- Priority or ordering value if multiple rename rules could match.

## Payment Method Rule

Defines when a mapped payment method should be hidden.

Conditions may include:

- Selected shipping method condition.
- Pincode group match or non-match.
- Product tag condition.
- Cart/order condition if needed.

## Storage Direction

Shopify metafields or metaobjects are preferred so checkout-time Shopify Functions can read rule configuration without an external database dependency.

