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
    <div className="bsure-page">
      <div className="bsure-shell">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h1 style={{ fontSize: "26px", fontWeight: 700, margin: 0, color: "#202223" }}>Checkout rules</h1>
              <span style={{
                background: "#b9f4cf",
                borderRadius: "8px",
                color: "#1a4731",
                fontSize: "13px",
                fontWeight: 650,
                padding: "3px 10px",
              }}>
                {isEmpty ? "0" : activeCount} Active
              </span>
            </div>
            <p style={{ margin: 0, color: "#5c5f62", fontSize: "14px" }}>
              Take control of the checkout with powerful conditional rules
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
            <Link
              style={{
                background: "#fff",
                border: "1px solid #babfc3",
                borderRadius: "8px",
                color: "#202223",
                fontWeight: 650,
                fontSize: "14px",
                padding: "9px 14px",
                textDecoration: "none",
              }}
              to="/app/import"
            >
              Import
            </Link>
            <Link
              style={{
                background: "#202223",
                border: "1px solid #202223",
                borderRadius: "8px",
                color: "#fff",
                fontWeight: 650,
                fontSize: "14px",
                padding: "9px 14px",
                textDecoration: "none",
              }}
              to="/app/shipping-rules"
            >
              Create rule
            </Link>
          </div>
        </div>

        {/* Rules Table */}
        <div style={{
          background: "#fff",
          border: "1px solid #d4d4d4",
          borderRadius: "12px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={thStyle}><input type="checkbox" /></th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Subtype</th>
                <th style={thStyle}>Activated on</th>
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
    <tr style={trStyle} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f6f6f7"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}>
      <td style={tdStyle}><input type="checkbox" /></td>
      <td style={tdStyle}>
        <Link style={{ color: "#202223", textDecoration: "none", fontWeight: 500 }} to={row.href}>
          {row.name}
        </Link>
      </td>
      <td style={tdStyle}>
        <Link to={row.href} style={{ textDecoration: "none" }}>
          <span style={row.status === "Active" ? activeStyle : deactivatedStyle}>
            {row.status}
          </span>
        </Link>
      </td>
      <td style={tdStyle}><Link style={linkStyle} to={row.href}>{row.type}</Link></td>
      <td style={tdStyle}><Link style={linkStyle} to={row.href}>{row.subtype}</Link></td>
      <td style={tdStyle}><Link style={linkStyle} to={row.href}>{row.activatedOn}</Link></td>
    </tr>
  );
}

function StarterRow({ row }: { row: typeof STARTER_ROWS[0] }) {
  return (
    <tr style={trStyle} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f6f6f7"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}>
      <td style={tdStyle}><input type="checkbox" /></td>
      <td style={tdStyle}>
        <Link style={{ color: "#202223", textDecoration: "none", fontWeight: 500 }} to={row.href}>
          {row.name}
        </Link>
      </td>
      <td style={tdStyle}>
        <span style={deactivatedStyle}>Deactivated</span>
      </td>
      <td style={tdStyle}><Link style={linkStyle} to={row.href}>{row.type}</Link></td>
      <td style={tdStyle}><Link style={linkStyle} to={row.href}>{row.subtype}</Link></td>
      <td style={tdStyle}></td>
    </tr>
  );
}

const thStyle: React.CSSProperties = {
  background: "#fafafa",
  borderBottom: "1px solid #e1e3e5",
  color: "#303030",
  fontSize: "13px",
  fontWeight: 650,
  padding: "12px 16px",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  borderTop: "1px solid #e1e3e5",
  color: "#202223",
  fontSize: "14px",
  padding: "12px 16px",
  verticalAlign: "middle",
};

const trStyle: React.CSSProperties = {
  cursor: "pointer",
  transition: "background 140ms ease",
};

const linkStyle: React.CSSProperties = {
  color: "#202223",
  display: "block",
  textDecoration: "none",
};

const activeStyle: React.CSSProperties = {
  background: "#b9f4cf",
  borderRadius: "8px",
  display: "inline-block",
  fontSize: "13px",
  fontWeight: 650,
  padding: "3px 10px",
  color: "#1a4731",
};

const deactivatedStyle: React.CSSProperties = {
  background: "#e4e5e7",
  borderRadius: "8px",
  display: "inline-block",
  fontSize: "13px",
  fontWeight: 650,
  padding: "3px 10px",
  color: "#4a4f54",
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
