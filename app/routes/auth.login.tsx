import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData } from "react-router";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = await login(request);
  return errors;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);
  return errors;
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const errors =
    loaderData &&
    typeof loaderData === "object" &&
    "shop" in loaderData
      ? (loaderData as { shop?: string })
      : {};

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        fontFamily: "Inter, sans-serif",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e1e3e5",
          borderRadius: "12px",
          maxWidth: "420px",
          padding: "2rem",
          width: "100%",
        }}
      >
        <h1
          style={{
            color: "#202223",
            fontSize: "1.25rem",
            fontWeight: 700,
            margin: "0 0 1rem",
          }}
        >
          Connect your Shopify store
        </h1>
        <Form method="post">
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label
              style={{
                color: "#202223",
                display: "grid",
                fontSize: "0.875rem",
                fontWeight: 600,
                gap: "0.35rem",
              }}
            >
              Shop domain
              <input
                name="shop"
                placeholder="your-store.myshopify.com"
                style={{
                  border: "1px solid #c9cccf",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  padding: "8px 12px",
                  width: "100%",
                  boxSizing: "border-box",
                }}
                type="text"
              />
            </label>
            {"shop" in errors && (
              <p style={{ color: "#d82c0d", fontSize: "0.8rem", margin: 0 }}>
                {errors.shop === "MISSING_SHOP"
                  ? "Please enter your shop domain."
                  : "Invalid shop domain."}
              </p>
            )}
            <button
              style={{
                background: "#008060",
                border: "none",
                borderRadius: "6px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
                padding: "10px 16px",
              }}
              type="submit"
            >
              Connect store
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = () => ({
  "Content-Security-Policy": "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
});
