# Phase 8 Delivery Customization

This phase starts the first Shopify Function boundary for Courtyard Checkout Rules.

## Step 8a status

The delivery customization extension is intentionally implemented as a no-op first. It returns an empty `operations` array so checkout delivery options remain unchanged while the extension build, deployment, and development-store activation flow are verified.

The input query reads the shop metafield at:

- namespace: `courtyard_checkout_rules`
- key: `published_config`

Step 8a should be used as the rollback build if Step 8b needs to be backed out.

## Development-store activation steps

Use only a development store for this phase.

1. Log in with Shopify CLI:

   ```powershell
   npx shopify auth login
   ```

2. Confirm the app is linked to the development app, not production:

   ```powershell
   npx shopify app config use
   ```

3. Build the function locally:

   ```powershell
   npm --workspace courtyard-delivery-customization run typegen
   npm --workspace courtyard-delivery-customization run build
   ```

4. Deploy the app to the development app only:

   ```powershell
   npx shopify app deploy
   ```

5. In the development store admin, create or enable the delivery customization from the app's extension page if Shopify does not activate it automatically.

6. Place a test checkout in the development store and confirm available shipping methods are unchanged.

Do not link this app to the production store, disable BSure, or enable this extension outside the development store during Step 8a.

## Step 8b scope

Step 8b reads the same shop metafield and supports delivery customization operations only:

- Read only published schema v2 configuration from `courtyard_checkout_rules.published_config`.
- Support shipping hide rules and shipping rename rules only.
- Apply hide rules before rename rules.
- Return empty operations when config is missing, invalid, unsupported, or too large for safe evaluation.
- Keep all business values sourced from admin-created rules and published configuration.

Supported delivery rule conditions in Step 8b:

- Shipping method mappings from published config.
- Pincode matches from the checkout delivery address.
- Area group and delivery availability text from the published pincode record.

Fail-safe unsupported conditions in Step 8b:

- Product tag conditions on shipping hide or rename rules.
- Cutoff/time conditions on shipping hide or rename rules.

If an active shipping hide or rename rule contains one of those unsupported conditions, the Function returns no operations. This keeps checkout behavior conservative until those inputs are explicitly added and tested in a later phase.

Step 8b does not add payment customization, checkout validation, product blocking, or any hardcoded operational values.

## Development-store Step 8b test

After deploying only to a development store:

1. Publish schema v2 config from the app admin.
2. Create a test shipping method mapping in admin configuration.
3. Create one enabled shipping hide or rename rule using only supported Step 8b conditions.
4. Start a development checkout whose address pincode matches the published pincode data.
5. Confirm the expected shipping method is hidden or renamed.
6. Disable the test rule or redeploy the no-op Step 8a build to confirm rollback.

Do not test Step 8b on a live store, do not disable BSure, and do not link this app to production.

## Rollback

Preferred rollback options:

1. Disable the delivery customization in the development store admin.
2. Redeploy the no-op function from Step 8a.
3. If needed, remove or unpublish the development app deployment.

Because Step 8a returns no operations, redeploying this version is the safest function-level rollback.
