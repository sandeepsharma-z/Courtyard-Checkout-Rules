# Import Strategy

The importer should convert delivery data into configurable pincode records and rule groups. It must not embed operational values in code.

## Supported Sources

- CSV files exported from spreadsheets.
- PDF data after conversion into a tabular format.
- Manual admin entries for values that are not present in imported files.

## Import Flow

1. Upload source data.
2. Detect or map columns.
3. Normalize pincode and text fields.
4. Validate required fields.
5. Preview changed, added, skipped, and invalid rows.
6. Admin approves import.
7. Save configuration into Shopify metafields or metaobjects.
8. Future Shopify Functions read the published configuration.

## Required Concepts

The importer should support these delivery data concepts:

- State.
- District.
- Pincode.
- Location or area name.
- Area group.
- Delivery availability.
- Same-day delivery rule.
- Next-day delivery rule.
- Product availability rule.
- Remarks.
- Charges or pricing text when present.
- Updated same-day rule.
- Updated next-day rule.

## Validation Rules

The importer should report:

- Missing required columns.
- Empty required pincode values.
- Duplicate pincode rows when duplicates are not expected.
- Ambiguous area group values.
- Unrecognized delivery availability values.
- Rows that require manual review.

## PDF Conversion Notes

PDF files should be converted to structured rows before import. The app should not assume that PDF text extraction is clean. Admin review is required before publishing converted data.

