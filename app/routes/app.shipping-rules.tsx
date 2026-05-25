import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function ShippingRulesPage() {
  return (
    <s-page heading="Shipping rules">
      <s-section heading="Planned configuration">
        <s-unordered-list>
          <s-list-item>Map Shopify shipping methods into admin records.</s-list-item>
          <s-list-item>Configure shipping method hide conditions.</s-list-item>
          <s-list-item>Configure shipping method rename conditions.</s-list-item>
          <s-list-item>Keep all labels and match values configurable.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
