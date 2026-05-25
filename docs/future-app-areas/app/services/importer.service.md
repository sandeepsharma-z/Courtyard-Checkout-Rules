# Importer Service

Future responsibility: process CSV or PDF-converted delivery data into configurable rule records.

## Responsibilities

- Accept structured rows from CSV or converted PDF data.
- Validate required columns.
- Normalize pincode, area group, and text fields.
- Detect invalid or ambiguous rows.
- Produce import preview results.
- Save approved data into Shopify-side configuration.

## Non-Responsibilities

- Do not hardcode delivery charges.
- Do not hardcode pincode lists.
- Do not infer permanent business rules without admin approval.
- Do not publish checkout-impacting changes without a review step.

