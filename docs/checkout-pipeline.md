# Checkout Pipeline

This document describes the intended checkout decision flow for the custom Courtyard Checkout Rules app.

## Customer Flow

```text
Customer enters checkout
↓
Customer enters shipping address and pincode
↓
Checkout configuration reads pincode, cart lines, product tags, shipping options, payment options, and timing context
↓
Rules evaluate pincode groups, delivery availability, product restrictions, cutoff settings, shipping mappings, and payment mappings
↓
Shopify Functions decide:
- which shipping methods to hide
- which shipping methods to rename
- which payment methods to hide
- whether checkout should be blocked
↓
Customer sees only valid checkout options
```

## Future Function Boundaries

### Delivery Customization

Responsible for shipping method hide and rename behavior.

Inputs should come from Shopify checkout context and Shopify-side rule configuration. Shipping method names and rename labels must be configurable values.

### Payment Customization

Responsible for payment method hide behavior.

Inputs should come from checkout context, selected shipping method data when available, and Shopify-side rule configuration. Payment method names must be configurable values.

### Checkout Validation

Responsible for blocking checkout based on pincode and product availability rules.

Validation messages must be configurable from admin and stored in Shopify-side configuration.

## Configuration Sources

Rule configuration should be produced by:

- Imported CSV data.
- PDF-converted tabular data.
- Manual admin panel configuration.

Checkout-time logic should read Shopify-side configuration only, such as metafields or metaobjects, and should not depend on an external database call.

