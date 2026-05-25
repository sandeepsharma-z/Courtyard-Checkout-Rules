# BSure Current Rules

This document captures the rule categories currently handled by BSure Checkout Rules and the intended equivalent custom Shopify app modules.

## Rule Categories To Replicate

### 1. All Product Validation

Purpose: block checkout when configured pincode and product tag conditions are met.

Future implementation:

- Read customer pincode from checkout delivery address.
- Match pincode against configured pincode groups.
- Match cart product tags against configured restriction rules.
- Return a configurable validation error message when the rule blocks checkout.
- Implement through a future cart/checkout validation Shopify Function.

No product tag value, pincode, or error message should be hardcoded.

### 2. All Shipping Method Hide

Purpose: hide shipping methods when configured conditions apply.

Possible condition inputs:

- Pincode or postal code.
- Area group.
- Time of day.
- Configured cutoff time.
- Shopify shipping method mapping.
- Product tags.
- Cart or customer conditions when needed.

Future implementation:

- Admin maps Shopify shipping method names into configurable records.
- Rules reference mapped methods instead of literal values in code.
- Implement through a future delivery customization Shopify Function.

### 3. All Shipping Method Rename

Purpose: rename shipping methods when configured conditions apply.

Possible condition inputs:

- Pincode or postal code.
- Time of day.
- Product tags.
- Subscription product tag or equivalent product classification.
- Delivery group.

Future implementation:

- Admin configures source shipping method mapping and target display label.
- Imported delivery labels can populate rename targets when available.
- Implement through a future delivery customization Shopify Function.

### 4. All Payment Method Hide

Purpose: hide payment methods when configured conditions apply.

Possible condition inputs:

- Selected shipping method contains configured text.
- Pincode matches or does not match a configured pincode group.
- Product tags.
- Cart or order conditions when needed.

Future implementation:

- Admin maps Shopify payment method names into configurable records.
- Rules reference mapped methods instead of literal values in code.
- Implement through a future payment customization Shopify Function.

## Documentation Gap

BSure screenshots, rule exports, and current store settings should be reviewed before implementation. Observations should be recorded in `notes/bsure-screenshot-observations.md`.

