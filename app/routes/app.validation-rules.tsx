import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function ValidationRulesPage() {
  return (
    <s-page heading="Validation rules">
      <s-section heading="Planned configuration">
        <s-paragraph>
          This screen will manage checkout-blocking rules and configurable error
          messages for the future checkout validation Function.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
