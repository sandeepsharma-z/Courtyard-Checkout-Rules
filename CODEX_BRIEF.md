# Courtyard Checkout Rules - Custom Shopify App Brief

We need to build a custom Shopify checkout rules app to replace the paid BSure Checkout Rules app.

Current paid app:
BSure Checkout Rules

Reason for custom build:
The current app has a recurring monthly charge. We need to understand the existing checkout pipeline first, then rebuild the same logic as a custom Shopify app for Courtyard Farms.

Project name:
courtyard-checkout-rules

Main goal:
Create a custom Shopify app that manages checkout rules using configurable pincode-wise delivery logic, product availability validation, shipping method hide/rename rules, and payment method hide rules.

Important:
Do not start full implementation yet.
First create a clean project-ready file structure and documentation files so the whole pipeline is understandable.

Very important rule:
Do not hardcode delivery charges, pincode lists, shipping method names, cutoff times, or product tag values in the app logic.
All such data must come from imported PDF/CSV data or from manual admin panel configuration.

Current BSure app rules to replicate:

1. All Product Validation
- Blocks checkout based on pincode/postal code and product tags.
- If customer's pincode is in a restricted pincode group and product tag matches, checkout should be blocked.
- Error message should be configurable from admin.
- This should later become a custom cart/checkout validation function.

2. All Shipping Method Hide
- Hides shipping methods based on configurable conditions.
- Conditions may include:
  - pincode/postal code
  - area group
  - time of day
  - cutoff time
  - selected shipping method
  - product tags
  - cart/customer conditions if needed
- Shipping method names must not be hardcoded.
- Admin should allow mapping existing Shopify shipping method names.
- This should later become a delivery customization function.

3. All Shipping Method Rename
- Renames shipping methods based on configurable conditions.
- Conditions may include:
  - pincode/postal code
  - time of day
  - product tags
  - subscription product tag
  - delivery group
- Old shipping method name and new shipping method name should be configurable.
- Rename labels must come from imported data or manual admin configuration.
- This should later become a delivery customization function.

4. All Payment Method Hide
- Hides payment methods based on configurable conditions.
- Example condition types:
  - selected shipping method contains specific text
  - pincode matches or does not match a pincode group
  - product tags
  - cart/order conditions
- Payment method names must be configurable.
- This should later become a payment customization function.

Delivery data logic:
- Delivery rules are pincode-wise.
- Pincode data may include:
  - state
  - district
  - pincode
  - location/area name
  - area group
  - delivery availability
  - same day delivery rule
  - next day delivery rule
  - product availability rule
  - remarks
  - charges/pricing text if present
  - updated same day rule
  - updated next day rule
- The app should support importing this data from CSV/PDF converted data.
- Any pricing/charge values must be stored as configurable rule values, not hardcoded.
- Any cutoff time must be configurable, not hardcoded.
- Any delivery labels must be configurable, not hardcoded.

Expected future app modules:
- Shopify admin dashboard
- CSV/PDF converted data importer
- Pincode group manager
- Product tag restriction manager
- Cutoff time settings
- Shipping method mapping
- Shipping hide rules
- Shipping rename rules
- Payment method rules
- Validation rules
- Test rule simulator
- Shopify Functions:
  - delivery customization
  - payment customization
  - cart/checkout validation

Preferred data storage:
- Use Shopify metafields/metaobjects for rule configuration so Shopify Functions can read rule data.
- Avoid external DB dependency for checkout-time logic.
- Admin panel can manage and write rule configuration into Shopify metafields/metaobjects.
- Shopify Functions should read from Shopify-side configuration only.

App pipeline to document:

Customer enters checkout
↓
Customer enters shipping address/pincode
↓
App checks pincode against configured pincode groups
↓
App checks cart products and product tags
↓
App checks time/cutoff rules
↓
App decides:
- which shipping methods to hide
- which shipping methods to rename
- which payment methods to hide
- whether checkout should be blocked
↓
Customer sees only valid checkout options

Create this file structure now:

```text
courtyard-checkout-rules/
├── README.md
├── CODEX_BRIEF.md
├── docs/
│   ├── bsure-current-rules.md
│   ├── checkout-pipeline.md
│   ├── data-model.md
│   ├── development-plan.md
│   ├── import-strategy.md
│   ├── rule-engine-notes.md
│   └── testing-checklist.md
├── data/
│   ├── sample-pincodes.csv
│   ├── rule-groups.example.json
│   └── imported-data-format.md
├── app/
│   ├── admin/
│   │   └── README.md
│   ├── components/
│   │   └── README.md
│   ├── routes/
│   │   └── README.md
│   ├── services/
│   │   ├── importer.service.md
│   │   ├── pincode-rules.service.md
│   │   ├── shipping-hide-rules.service.md
│   │   ├── shipping-rename-rules.service.md
│   │   ├── payment-rules.service.md
│   │   └── validation-rules.service.md
│   └── utils/
│       └── README.md
├── extensions/
│   ├── delivery-customization/
│   │   └── README.md
│   ├── payment-customization/
│   │   └── README.md
│   └── checkout-validation/
│       └── README.md
└── notes/
    ├── open-questions.md
    ├── bsure-screenshot-observations.md
    └── no-hardcoding-rules.md
```

Strict instruction:
Do not hardcode any specific price, delivery charge, pincode list, cutoff time, product tag, or shipping/payment method name as final logic.
Only mention sample placeholders where required.
All real values must come from imported data or admin configuration.

Do not install dependencies yet.
Do not create actual Shopify app code yet.
Only prepare the project documentation and file structure.

