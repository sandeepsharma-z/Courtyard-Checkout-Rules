# Rule Engine Notes

This document records planned behavior for the future configurable rule engine.

## Rule Inputs

Rules may evaluate:

- Checkout pincode or postal code.
- Pincode group.
- Area group.
- Cart products.
- Product tags.
- Shipping method mapping.
- Payment method mapping.
- Time of day and configured cutoff setting.
- Cart, customer, or order conditions if needed later.

## Evaluation Principles

- All operational values come from imported data or admin configuration.
- Shopify Functions should read published Shopify-side configuration only.
- Rules should be deterministic for the same checkout context and configuration.
- Admin should be able to disable a rule without deleting it.
- Rule conflicts should be handled through explicit priority or documented precedence.

## Suggested Order

1. Normalize checkout inputs.
2. Match pincode to configured pincode records and groups.
3. Match cart product tags to configured restrictions.
4. Evaluate cutoff and timing conditions.
5. Evaluate validation blocks.
6. Evaluate shipping method hide rules.
7. Evaluate shipping method rename rules.
8. Evaluate payment method hide rules.

## Conflict Handling

Implementation should define clear precedence before launch. Recommended defaults:

- Validation blocks should produce clear configurable messages.
- Hide rules should take priority over rename rules for the same shipping method.
- More specific pincode rules should take priority over broader area-group rules when both exist.
- Disabled rules should never apply.

These defaults should be confirmed against BSure behavior during rule discovery.

