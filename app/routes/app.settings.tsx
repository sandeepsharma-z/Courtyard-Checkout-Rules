import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return {};
};

export default function SettingsPage() {
  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <h1>Settings</h1>
          </div>
        </div>

        <div className="bsure-flow" style={{ marginTop: "16px" }}>
          <section className="bsure-card">
            <h2>Pincode delivery data</h2>
            <p style={{ color: "#5c5f62", fontSize: "14px", margin: "6px 0 14px" }}>
              Manage manually entered pincode delivery records used by rules.
            </p>
            <Link className="bsure-button secondary" to="/app/pincodes">
              Manage pincode data
            </Link>
          </section>

          <section className="bsure-card">
            <h2>Publish config</h2>
            <p style={{ color: "#5c5f62", fontSize: "14px", margin: "6px 0 14px" }}>
              Publish your configured rules as a Shopify metafield snapshot so checkout functions can read them.
            </p>
            <Link className="bsure-button" to="/app/publish">
              Publish config
            </Link>
          </section>

          <section className="bsure-card">
            <h2>Shipping method mappings</h2>
            <p style={{ color: "#5c5f62", fontSize: "14px", margin: "6px 0 14px" }}>
              Manage named shipping method patterns for use in rules.
            </p>
            <Link className="bsure-button secondary" to="/app/shipping-mappings">
              Manage mappings
            </Link>
          </section>

          <section className="bsure-card">
            <h2>Cutoff time settings</h2>
            <p style={{ color: "#5c5f62", fontSize: "14px", margin: "6px 0 14px" }}>
              Configure time-based cutoff rules for delivery windows.
            </p>
            <Link className="bsure-button secondary" to="/app/cutoff-settings">
              Manage cutoff settings
            </Link>
          </section>

          <section className="bsure-card">
            <h2>Checkout behaviour</h2>
            <p style={{ color: "#5c5f62", fontSize: "14px", margin: "6px 0 14px" }}>
              Default shipping method for unconfigured pincodes, and unknown
              pincode blocking.
            </p>
            <Link className="bsure-button secondary" to="/app/checkout-settings">
              Manage checkout behaviour
            </Link>
          </section>

          <section className="bsure-card">
            <h2>CSV import</h2>
            <p style={{ color: "#5c5f62", fontSize: "14px", margin: "6px 0 14px" }}>
              Import pincode data from a CSV file.
            </p>
            <Link className="bsure-button secondary" to="/app/import">
              Import CSV
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
