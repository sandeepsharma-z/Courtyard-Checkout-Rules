import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function PaymentRulesPage() {
  return (
    <s-page heading="Payment rules">
      <s-section heading="Planned configuration">
        <s-paragraph>
          This screen will map Shopify payment methods and configure hide rules
          based on pincode groups, selected shipping conditions, product tags,
          and cart or order conditions where supported.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
