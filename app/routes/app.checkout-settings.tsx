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

export default function CheckoutSettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

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
          <div
            className="bsure-card"
            style={{ marginTop: "16px", background: "#e3f1df", borderColor: "#aee9d1" }}
          >
            Saved. <b>Now publish</b> for it to take effect at checkout:{" "}
            <Link to="/app/publish">Publish config</Link>.
          </div>
        )}

        <Form method="post" className="bsure-flow" style={{ marginTop: "16px" }}>
          <section className="bsure-card">
            <h2>Default shipping method (unconfigured pincodes)</h2>
            <p style={{ color: "#5c5f62", fontSize: "14px", margin: "6px 0 14px" }}>
              For any pincode that is <b>not matched by a shipping rule</b>, show
              only the delivery option whose name contains this text and hide the
              rest. Leave blank to show all options (no change).
            </p>
            <input
              className="bsure-input"
              name="defaultShippingMethod"
              defaultValue={settings.defaultShippingMethod}
              placeholder="e.g. 5-8 Days Delivery"
              style={{ width: "100%", maxWidth: "420px" }}
            />
          </section>

          <section className="bsure-card">
            <h2>Block unknown pincodes</h2>
            <p style={{ color: "#5c5f62", fontSize: "14px", margin: "6px 0 14px" }}>
              When enabled, checkout is blocked (with the message below) for any
              pincode not present in your published pincode data.
            </p>
            <div className="bsure-radio" style={{ marginBottom: "10px" }}>
              <input
                defaultChecked={settings.blockUnknownPincode}
                id="blockUnknownPincode"
                name="blockUnknownPincode"
                type="checkbox"
              />
              <label htmlFor="blockUnknownPincode">
                Block checkout for unknown pincodes
              </label>
            </div>
            <input
              className="bsure-input"
              name="unknownPincodeMessage"
              defaultValue={settings.unknownPincodeMessage}
              placeholder="Message shown to the customer"
              style={{ width: "100%", maxWidth: "420px" }}
            />
          </section>

          <div>
            <button className="bsure-button" type="submit">
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
