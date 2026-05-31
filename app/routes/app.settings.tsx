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

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "16px",
          marginTop: "20px",
        }}>
          {[
            {
              icon: "📍",
              title: "Pincode delivery data",
              desc: "Manage manually entered pincode delivery records used by rules.",
              to: "/app/pincodes",
              label: "Manage pincode data",
              primary: false,
            },
            {
              icon: "🚀",
              title: "Publish config",
              desc: "Publish your configured rules as a Shopify metafield so checkout functions can read them.",
              to: "/app/publish",
              label: "Publish config",
              primary: true,
            },
            {
              icon: "🚚",
              title: "Shipping method mappings",
              desc: "Manage named shipping method patterns for use in rules.",
              to: "/app/shipping-mappings",
              label: "Manage mappings",
              primary: false,
            },
            {
              icon: "⏰",
              title: "Cutoff time settings",
              desc: "Configure time-based cutoff rules for delivery windows.",
              to: "/app/cutoff-settings",
              label: "Manage cutoff settings",
              primary: false,
            },
            {
              icon: "⚙️",
              title: "Checkout behaviour",
              desc: "Default shipping method for unconfigured pincodes, and unknown pincode blocking.",
              to: "/app/checkout-settings",
              label: "Manage checkout behaviour",
              primary: false,
            },
            {
              icon: "📥",
              title: "CSV import",
              desc: "Import pincode data from a CSV file.",
              to: "/app/import",
              label: "Import CSV",
              primary: false,
            },
          ].map((item) => (
            <div
              key={item.to}
              style={{
                background: "#fff",
                border: "1px solid #e3e3e3",
                borderRadius: "12px",
                padding: "20px 20px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontSize: "22px", marginBottom: "2px" }}>{item.icon}</div>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#1a1a1a" }}>
                {item.title}
              </h2>
              <p style={{ margin: "4px 0 14px", color: "#6d7175", fontSize: "13px", lineHeight: "1.5", flexGrow: 1 }}>
                {item.desc}
              </p>
              <div>
                <Link
                  to={item.to}
                  style={{
                    display: "inline-block",
                    padding: "8px 18px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    textDecoration: "none",
                    background: item.primary ? "#1a7a4a" : "#f3f3f3",
                    color: item.primary ? "#fff" : "#333",
                    border: item.primary ? "none" : "1px solid #ddd",
                    transition: "opacity 0.15s",
                  }}
                >
                  {item.label} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
