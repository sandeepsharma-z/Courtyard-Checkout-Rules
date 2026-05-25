# Imported Data Format

This document describes the expected structure for CSV or PDF-converted delivery data.

## Required Columns

The importer should support these columns:

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

## Placeholder Policy

The sample CSV uses placeholder values only. Real pincode, delivery, charge, cutoff, product tag, shipping method, payment method, and label values must come from imported data or admin configuration.

## Normalization

Future importer behavior should normalize:

- Column names into the expected internal names.
- Pincode values into a consistent string format.
- Empty cells into explicit blank or null values.
- Repeated whitespace in text fields.
- Area group labels into admin-reviewable group records.

## Review Before Publish

Imports should be previewed before publishing. Admins should be able to confirm row counts, invalid rows, changed records, and generated groups before checkout behavior changes.

