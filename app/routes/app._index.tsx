import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getRuleManagerData } from "../services/rule-config-storage.server";

type RuleRow = {
  activatedOn: string;
  href: string;
  name: string;
  status: "Active" | "Deactivated";
  subtype: string;
  type: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const data = await getRuleManagerData();

  const rows: RuleRow[] = [
    {
      activatedOn: latestDate(data.shippingRenameRules),
      href: "/app/shipping-rules",
      name: "Rename shipping methods",
      status: hasEnabled(data.shippingRenameRules) ? "Active" : "Deactivated",
      subtype: "Rename",
      type: "Shipping",
    },
    {
      activatedOn: latestDate(data.productRestrictionRules),
      href: "/app/product-restrictions",
      name: "All Product Validation",
      status: hasEnabled(data.productRestrictionRules) ? "Active" : "Deactivated",
      subtype: "Block",
      type: "Validation",
    },
    {
      activatedOn: latestDate(data.shippingHideRules),
      href: "/app/shipping-rules",
      name: "All Shipping Method Hide",
      status: hasEnabled(data.shippingHideRules) ? "Active" : "Deactivated",
      subtype: "Hide",
      type: "Shipping",
    },
    {
      activatedOn: latestDate(data.shippingRenameRules),
      href: "/app/shipping-rules",
      name: "All Shipping Method Rename",
      status: hasEnabled(data.shippingRenameRules) ? "Active" : "Deactivated",
      subtype: "Rename",
      type: "Shipping",
    },
    {
      activatedOn: latestDate(data.paymentHideRules),
      href: "/app/payment-rules",
      name: "All Payment Method Hide",
      status: hasEnabled(data.paymentHideRules) ? "Active" : "Deactivated",
      subtype: "Hide",
      type: "Payment",
    },
    {
      activatedOn: latestDate(data.cutoffRuleSettings),
      href: "/app/cutoff-settings",
      name: "Cutoff time settings",
      status: hasEnabled(data.cutoffRuleSettings) ? "Active" : "Deactivated",
      subtype: "Time",
      type: "Shipping",
    },
    {
      activatedOn: latestDate(data.shippingMethodMappings),
      href: "/app/shipping-mappings",
      name: "Shipping method mappings",
      status: hasEnabled(data.shippingMethodMappings) ? "Active" : "Deactivated",
      subtype: "Mapping",
      type: "Shipping",
    },
    {
      activatedOn: "",
      href: "/app/import",
      name: "Pincode CSV import",
      status: "Active",
      subtype: "Import",
      type: "Data",
    },
    {
      activatedOn: "",
      href: "/app/simulator",
      name: "Rule simulator",
      status: "Active",
      subtype: "Preview",
      type: "Testing",
    },
    {
      activatedOn: "",
      href: "/app/publish",
      name: "Publish Shopify config",
      status: "Active",
      subtype: "Snapshot",
      type: "Config",
    },
  ];

  return {
    activeCount: rows.filter((row) => row.status === "Active").length,
    rows,
  };
};

export default function Dashboard() {
  const { activeCount, rows } = useLoaderData<typeof loader>();

  return (
    <div className="rules-page">
      <div className="rules-shell">
        <header className="rules-header">
          <div className="rules-heading">
            <h1>Checkout rules</h1>
            <span className="rules-status active">{activeCount} Active</span>
            <p>Take control of checkout with configurable pincode, shipping, payment, validation, import, publish, and simulator workflows.</p>
          </div>
          <div className="bsure-actions">
            <Link className="bsure-button secondary" to="/app/import">Import</Link>
            <Link className="bsure-button" to="/app/shipping-rules">Create rule</Link>
          </div>
        </header>

        <div className="rules-table-card">
          <table className="rules-table">
            <thead>
              <tr>
                <th aria-label="Select rule" />
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>Subtype</th>
                <th>Activated on</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="rules-row" key={`${row.type}-${row.subtype}-${row.name}`}>
                  <td>
                    <Link aria-label={`Open ${row.name}`} to={row.href}>
                      <span className="rules-checkbox" />
                    </Link>
                  </td>
                  <td>
                    <Link to={row.href}>{row.name}</Link>
                  </td>
                  <td>
                    <Link to={row.href}>
                      <span className={row.status === "Active" ? "rules-status active" : "rules-status deactivated"}>{row.status}</span>
                    </Link>
                  </td>
                  <td>
                    <Link to={row.href}>{row.type}</Link>
                  </td>
                  <td>
                    <Link to={row.href}>{row.subtype}</Link>
                  </td>
                  <td>
                    <Link to={row.href}>{row.activatedOn}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function hasEnabled(items: Array<{ enabled: boolean }>) {
  return items.some((item) => item.enabled);
}

function latestDate(items: Array<{ createdAt: Date | string; enabled: boolean }>) {
  const latest = items
    .filter((item) => item.enabled)
    .map((item) => new Date(item.createdAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  if (!latest) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(latest));
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
