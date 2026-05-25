# No-Hardcoding Rules

This project must not hardcode operational checkout values in app logic or Shopify Function logic.

## Values That Must Be Configurable

- Delivery charges.
- Pricing or charge text.
- Pincode lists.
- Area groups.
- Delivery availability labels.
- Same-day and next-day delivery labels.
- Cutoff times.
- Product tag values.
- Shipping method names.
- Shipping rename labels.
- Payment method names.
- Checkout validation messages.

## Allowed In Documentation And Tests

Placeholders are allowed when they are clearly marked as non-production examples:

- `PINCODE_PLACEHOLDER`
- `PRODUCT_TAG_PLACEHOLDER`
- `SHIPPING_METHOD_PLACEHOLDER`
- `PAYMENT_METHOD_PLACEHOLDER`
- `CUTOFF_TIME_PLACEHOLDER`
- `CHARGE_TEXT_PLACEHOLDER`

## Implementation Requirement

Future app logic should read operational values from imported data or admin-managed configuration. Shopify Functions should read published Shopify-side configuration, preferably metafields or metaobjects, for checkout-time behavior.

