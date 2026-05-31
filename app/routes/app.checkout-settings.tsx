import type { CSSProperties } from "react";
import { useActionToast } from "../components/Toast";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  getCheckoutRuleSettings,
  saveCheckoutRuleSettings,
} from "../services/checkout-settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const settings = await getCheckoutRuleSettings();
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const current = await getCheckoutRuleSettings();

  await saveCheckoutRuleSettings({
    ...current,
    defaultShippingMethod: String(
      formData.get("defaultShippingMethod") ?? "",
    ).trim(),
    blockUnknownPincode: formData.get("blockUnknownPincode") === "on",
    unknownPincodeMessage: String(
      formData.get("unknownPincodeMessage") ?? "",
    ).trim(),
  });

  return { saved: true };
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e3e3e3",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};
const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 600,
  color: "#1a1a1a",
};
const descStyle: CSSProperties = {
  color: "#6d7175",
  fontSize: "13px",
  lineHeight: 1.5,
  margin: "4px 0 14px",
};
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #c9cccf",
  borderRadius: "8px",
  fontSize: "14px",
  boxSizing: "border-box",
};

export default function CheckoutSettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  useActionToast(actionData ? { status: "success", message: "Settings saved! Publish config for changes to take effect." } : undefined);

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <h1>Checkout behaviour settings</h1>
          </div>
          <Link className="bsure-button secondary" to="/app/settings">
            Back to settings
          </Link>
        </div>

        {actionData?.saved && (
          <div style={{
            marginTop: "16px",
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "14px",
            background: "#e3f1df",
            border: "1px solid #aee9d1",
            color: "#1a5c35",
          }}>
            ✓ Saved. <b>Now publish</b> for it to take effect at checkout:{" "}
            <Link to="/app/publish" style={{ color: "#1a7a4a", fontWeight: 600 }}>
              Publish config
            </Link>.
          </div>
        )}

        <Form method="post" style={{ marginTop: "20px", display: "grid", gap: "16px", maxWidth: "640px" }}>
          <section style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "18px" }}>🚚</span>
              <h2 style={headingStyle}>Default shipping method</h2>
            </div>
            <p style={descStyle}>
              For any pincode <b>not matched by a shipping rule</b>, show only the
              delivery option whose name contains this text and hide the rest.
              Leave blank to show all options.
            </p>
            <input
              style={inputStyle}
              name="defaultShippingMethod"
              defaultValue={settings.defaultShippingMethod}
              placeholder="e.g. 5-8 Days Delivery"
            />
          </section>

          <section style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "18px" }}>🚫</span>
              <h2 style={headingStyle}>Block unknown pincodes</h2>
            </div>
            <p style={descStyle}>
              When enabled, checkout is blocked (with the message below) for any
              pincode not present in your published pincode data.
            </p>
            <label style={{
              display: "flex", alignItems: "center", gap: "8px",
              fontSize: "14px", color: "#1a1a1a", marginBottom: "12px", cursor: "pointer",
            }}>
              <input
                defaultChecked={settings.blockUnknownPincode}
                name="blockUnknownPincode"
                type="checkbox"
                style={{ width: "16px", height: "16px" }}
              />
              Block checkout for unknown pincodes
            </label>
            <input
              style={inputStyle}
              name="unknownPincodeMessage"
              defaultValue={settings.unknownPincodeMessage}
              placeholder="Message shown to the customer"
            />
          </section>

          <div>
            <button type="submit" style={{
              background: "#1a7a4a", color: "#fff", border: "none",
              borderRadius: "8px", padding: "10px 24px",
              fontSize: "14px", fontWeight: 600, cursor: "pointer",
            }}>
              Save settings
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (
  headersArgs: Parameters<HeadersFunction>[0],
) => boundary.headers(headersArgs);
