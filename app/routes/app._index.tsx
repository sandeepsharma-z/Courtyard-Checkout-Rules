import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getRuleManagerData } from "../services/rule-config-storage.server";

type RuleRow = {
  id: string;
  name: string;
  status: "Active" | "Deactivated";
  type: string;
  subtype: string;
  href: string;
  activatedOn: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const data = await getRuleManagerData();

  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(d));

  const rows: RuleRow[] = [
    ...data.shippingHideRules.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Shipping",
      subtype: "Hide",
      href: "/app/shipping-rules",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
    })),
    ...data.shippingRenameRules.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Shipping",
      subtype: "Rename",
      href: "/app/shipping-rules",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
    })),
    ...data.paymentHideRules.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Payment",
      subtype: "Hide",
      href: "/app/payment-rules",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
    })),
    ...data.productRestrictionRules.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Validation",
      subtype: "Block",
      href: "/app/product-restrictions",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
    })),
    ...data.cutoffRuleSettings.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Shipping",
      subtype: "Time",
      href: "/app/cutoff-settings",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
    })),
    ...data.shippingMethodMappings.map((r) => ({
      id: r.id,
      name: r.name,
      status: "Active" as RuleRow["status"],
      type: "Shipping",
      subtype: "Mapping",
      href: "/app/shipping-mappings",
      activatedOn: fmt(r.createdAt),
    })),
  ];

  const activeCount = rows.filter((r) => r.status === "Active").length;

  return { rows, activeCount, isEmpty: rows.length === 0 };
};

const STARTER_ROWS = [
  { name: "All Shipping Method Hide",   type: "Shipping",   subtype: "Hide",    href: "/app/shipping-rules" },
  { name: "All Shipping Method Rename", type: "Shipping",   subtype: "Rename",  href: "/app/shipping-rules" },
  { name: "All Payment Method Hide",    type: "Payment",    subtype: "Hide",    href: "/app/payment-rules" },
  { name: "All Product Validation",     type: "Validation", subtype: "Block",   href: "/app/product-restrictions" },
  { name: "Cutoff time settings",       type: "Shipping",   subtype: "Time",    href: "/app/cutoff-settings" },
  { name: "Shipping method mappings",   type: "Shipping",   subtype: "Mapping", href: "/app/shipping-mappings" },
  { name: "Pincode CSV import",         type: "Data",       subtype: "Import",  href: "/app/import" },
  { name: "Rule simulator",            type: "Testing",    subtype: "Preview", href: "/app/simulator" },
  { name: "Publish Shopify config",     type: "Config",     subtype: "Snapshot",href: "/app/publish" },
];

export default function Dashboard() {
  const { activeCount, isEmpty, rows } = useLoaderData<typeof loader>();

  return (
    <div className="rules-page">
      <div className="rules-shell">
        <div className="rules-header">
          <div>
            <div className="rules-heading">
              <h1>Checkout rules</h1>
              <span className="rules-status active">
                {isEmpty ? "0" : activeCount} Active
              </span>
              <p>Take control of the checkout with powerful conditional rules</p>
            </div>
          </div>
          <div className="rules-actions">
            <Link className="bsure-button secondary" to="/app/import">
              Import
            </Link>
            <Link className="bsure-button" to="/app/shipping-rules">
              Create rule
            </Link>
          </div>
        </div>

        <div className="rules-table-card">
          <table className="rules-table">
            <thead>
              <tr>
                <th><input className="rules-checkbox-input" type="checkbox" /></th>
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>Subtype</th>
                <th>Activated on</th>
              </tr>
            </thead>
            <tbody>
              {isEmpty
                ? STARTER_ROWS.map((row) => (
                    <StarterRow key={row.name} row={row} />
                  ))
                : rows.map((row) => (
                    <DataRow key={row.id} row={row} />
                  ))
              }
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

function DataRow({ row }: { row: RuleRow }) {
  return (
    <tr className="rules-row">
      <td><input className="rules-checkbox-input" type="checkbox" /></td>
      <td>
        <Link className="rules-name-link" to={row.href}>
          {row.name}
        </Link>
      </td>
      <td>
        <Link to={row.href}>
          <span className={`rules-status ${row.status === "Active" ? "active" : "deactivated"}`}>
            {row.status}
          </span>
        </Link>
      </td>
      <td><Link to={row.href}>{row.type}</Link></td>
      <td><Link to={row.href}>{row.subtype}</Link></td>
      <td><Link to={row.href}>{row.activatedOn}</Link></td>
    </tr>
  );
}

function StarterRow({ row }: { row: typeof STARTER_ROWS[0] }) {
  return (
    <tr className="rules-row">
      <td><input className="rules-checkbox-input" type="checkbox" /></td>
      <td>
        <Link className="rules-name-link" to={row.href}>
          {row.name}
        </Link>
      </td>
      <td>
        <span className="rules-status deactivated">Deactivated</span>
      </td>
      <td><Link to={row.href}>{row.type}</Link></td>
      <td><Link to={row.href}>{row.subtype}</Link></td>
      <td></td>
    </tr>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
