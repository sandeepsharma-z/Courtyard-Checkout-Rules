import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function Dashboard() {
  return (
    <s-page heading="Courtyard Checkout Rules">
      <s-section heading="Phase 2 app shell">
        <s-paragraph>
          This admin app is ready for configuration screens. Rule execution,
          Shopify Functions, and production checkout logic are intentionally not
          implemented yet.
        </s-paragraph>
      </s-section>

      <s-section heading="Configuration direction">
        <s-unordered-list>
          <s-list-item>Import pincode-wise delivery data from CSV.</s-list-item>
          <s-list-item>Review imported rows before publishing changes.</s-list-item>
          <s-list-item>Store admin-managed rules in Shopify metaobjects.</s-list-item>
          <s-list-item>
            Publish compact checkout configuration to Shopify metafields for
            future Functions.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="No-hardcoding rule">
        <s-paragraph>
          Delivery charges, pincodes, cutoff times, product tags, shipping
          method names, payment method names, and checkout labels must come from
          imported data or admin configuration.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
