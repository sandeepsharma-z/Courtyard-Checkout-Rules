import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function SimulatorPage() {
  return (
    <s-page heading="Rule simulator">
      <s-section heading="Planned simulator">
        <s-paragraph>
          This screen will test configured pincode, cart, product tag, timing,
          shipping, payment, and validation scenarios before publishing checkout
          configuration.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
