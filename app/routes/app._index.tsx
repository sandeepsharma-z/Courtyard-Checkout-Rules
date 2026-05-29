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
  groupKey: string;
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
    ...data.productRestrictionRules.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Validation",
      subtype: "Block",
      href: "/app/product-restrictions",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
      groupKey: "product-validation",
    })),
    ...data.shippingHideRules.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Shipping",
      subtype: "Hide",
      href: "/app/shipping-rules",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
      groupKey: "shipping-hide",
    })),
    ...data.shippingRenameRules.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Shipping",
      subtype: "Rename",
      href: "/app/shipping-rules",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
      groupKey: "shipping-rename",
    })),
    ...data.paymentHideRules.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Payment",
      subtype: "Hide",
      href: "/app/payment-rules",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
      groupKey: "payment-hide",
    })),
  ];

  const dashboardRows = mergeDashboardRows(rows);
  const activeCount = dashboardRows.filter((r) => r.status === "Active").length;

  return { activeCount, rows: dashboardRows };
};

const STARTER_ROWS = [
  {
    groupKey: "product-validation",
    name: "All Product Validation",
    type: "Validation",
    subtype: "Block",
    href: "/app/product-restrictions",
  },
  {
    groupKey: "shipping-hide",
    name: "All Shipping Method Hide",
    type: "Shipping",
    subtype: "Hide",
    href: "/app/shipping-rules?mode=hide",
  },
  {
    groupKey: "shipping-rename",
    name: "All Shipping Method Rename",
    type: "Shipping",
    subtype: "Rename",
    href: "/app/shipping-rules?mode=rename",
  },
  {
    groupKey: "payment-hide",
    name: "All Payment Method Hide",
    type: "Payment",
    subtype: "Hide",
    href: "/app/payment-rules",
  },
];

function mergeDashboardRows(rows: RuleRow[]) {
  return STARTER_ROWS.map((starter) => {
    const groupRows = rows.filter((row) => row.groupKey === starter.groupKey);
    const activeRows = groupRows.filter((row) => row.status === "Active");
    const displayRows = activeRows.length ? activeRows : groupRows;
    const firstDisplayRow = displayRows[0];

    return {
      id: starter.groupKey,
      name: starter.name,
      status: activeRows.length ? "Active" : "Deactivated",
      type: starter.type,
      subtype: starter.subtype,
      href: starter.href,
      activatedOn: firstDisplayRow?.activatedOn || "",
      groupKey: starter.groupKey,
    } satisfies RuleRow;
  });
}

export default function Dashboard() {
  const { activeCount, rows } = useLoaderData<typeof loader>();

  return (
    <div className="rules-page">
      <div className="rules-shell">
        <div className="rules-header">
          <div>
            <div className="rules-heading">
              <h1>Checkout rules</h1>
              <span className="rules-status active">{activeCount} Active</span>
              <p>
                Take control of the checkout with powerful conditional rules
              </p>
            </div>
          </div>
          <div className="rules-actions">
            <Link className="bsure-button" to="/app/product-restrictions">
              Create rule
            </Link>
          </div>
        </div>

        <div className="rules-table-card">
          <table className="rules-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>Subtype</th>
                <th>Activated on</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <DataRow key={row.id} row={row} />
              ))}
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
      <td>
        <Link className="rules-name-link" to={row.href}>
          {row.name}
        </Link>
      </td>
      <td>
        <Link to={row.href}>
          <span
            className={`rules-status ${row.status === "Active" ? "active" : "deactivated"}`}
          >
            {row.status}
          </span>
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
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
