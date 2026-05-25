# Testing Checklist

Use this checklist during future implementation and migration.

## Documentation Scaffold

- [ ] All requested folders exist.
- [ ] All requested files exist.
- [ ] Markdown files contain useful starter documentation.
- [ ] Sample data uses placeholders only.
- [ ] No dependency or package files were created.
- [ ] No executable Shopify app or Function code was created.

## Importer

- [ ] CSV with expected columns imports successfully.
- [ ] Missing required columns are reported.
- [ ] Invalid pincode rows are reported.
- [ ] Duplicate rows are handled according to configured policy.
- [ ] PDF-converted data requires review before publish.
- [ ] Imported charge text remains configurable data, not code.

## Rule Configuration

- [ ] Pincode groups can be created and edited.
- [ ] Product tag restrictions can be configured.
- [ ] Cutoff settings can be configured.
- [ ] Shipping method mappings can be configured.
- [ ] Payment method mappings can be configured.
- [ ] Validation messages can be configured.

## Checkout Behavior

- [ ] Restricted products are blocked for matching configured pincode groups.
- [ ] Shipping methods hide under configured conditions.
- [ ] Shipping methods rename under configured conditions.
- [ ] Payment methods hide under configured conditions.
- [ ] Non-matching checkouts are not affected.
- [ ] Disabled rules do not apply.

## Migration Parity

- [ ] BSure screenshots and exports have been reviewed.
- [ ] Each current BSure rule has a matching custom rule.
- [ ] Simulator results match expected BSure behavior.
- [ ] Production rollout has a rollback plan.

