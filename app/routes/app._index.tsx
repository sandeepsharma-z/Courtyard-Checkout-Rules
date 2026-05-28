import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getActivePincodeSummary } from "../services/pincode-storage.server";
import { getPublishHistory } from "../services/published-config.server";
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
  const [data, pincodeSummary, publishHistory] = await Promise.all([
    getRuleManagerData(),
    getActivePincodeSummary(),
    getPublishHistory(),
  ]);

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
    ...data.cutoffRuleSettings.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Shipping",
      subtype: "Time",
      href: "/app/cutoff-settings",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
      groupKey: "cutoff-settings",
    })),
    ...data.shippingMethodMappings.map((r) => ({
      id: r.id,
      name: r.name,
      status: (r.enabled ? "Active" : "Deactivated") as RuleRow["status"],
      type: "Shipping",
      subtype: "Mapping",
      href: "/app/shipping-mappings",
      activatedOn: r.enabled ? fmt(r.createdAt) : "",
      groupKey: "shipping-mappings",
    })),
  ];

  const latestPublishedSnapshot = publishHistory.find(
    (snapshot) => snapshot.status === "published",
  );
  const dashboardRows = mergeDashboardRows(rows, {
    importActivatedOn: pincodeSummary.approvedBatch?.approvedAt
      ? fmt(pincodeSummary.approvedBatch.approvedAt)
      : "",
    importIsActive: pincodeSummary.activeCount > 0,
    publishActivatedOn: latestPublishedSnapshot?.publishedAt
      ? fmt(latestPublishedSnapshot.publishedAt)
      : "",
    publishIsActive: Boolean(latestPublishedSnapshot),
  });
  const activeCount = dashboardRows.filter((r) => r.status === "Active").length;

  return { activeCount, rows: dashboardRows };
};

const STARTER_ROWS = [
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
  {
    groupKey: "product-validation",
    name: "All Product Validation",
    type: "Validation",
    subtype: "Block",
    href: "/app/product-restrictions",
  },
  {
    groupKey: "cutoff-settings",
    name: "Cutoff time settings",
    type: "Shipping",
    subtype: "Time",
    href: "/app/cutoff-settings",
  },
  {
    groupKey: "shipping-mappings",
    name: "Shipping method mappings",
    type: "Shipping",
    subtype: "Mapping",
    href: "/app/shipping-mappings",
  },
  {
    groupKey: "pincode-import",
    name: "Pincode CSV import",
    type: "Data",
    subtype: "Import",
    href: "/app/import",
  },
  {
    groupKey: "simulator",
    name: "Rule simulator",
    type: "Testing",
    subtype: "Preview",
    href: "/app/simulator",
  },
  {
    groupKey: "publish",
    name: "Publish Shopify config",
    type: "Config",
    subtype: "Snapshot",
    href: "/app/publish",
  },
];

function mergeDashboardRows(
  rows: RuleRow[],
  statusOverrides: {
    importActivatedOn: string;
    importIsActive: boolean;
    publishActivatedOn: string;
    publishIsActive: boolean;
  },
) {
  return STARTER_ROWS.map((starter) => {
    const groupRows = rows.filter((row) => row.groupKey === starter.groupKey);
    const activeRows = groupRows.filter((row) => row.status === "Active");
    const displayRows = activeRows.length ? activeRows : groupRows;
    const firstDisplayRow = displayRows[0];

    const override =
      starter.groupKey === "pincode-import"
        ? {
            active: statusOverrides.importIsActive,
            activatedOn: statusOverrides.importActivatedOn,
          }
        : starter.groupKey === "publish"
          ? {
              active: statusOverrides.publishIsActive,
              activatedOn: statusOverrides.publishActivatedOn,
            }
          : null;

    return {
      id: starter.groupKey,
      name: starter.name,
      status: override?.active || activeRows.length ? "Active" : "Deactivated",
      type: starter.type,
      subtype: starter.subtype,
      href: starter.href,
      activatedOn: override?.activatedOn || firstDisplayRow?.activatedOn || "",
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
                <th>
                  <input className="rules-checkbox-input" type="checkbox" />
                </th>
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
        <input className="rules-checkbox-input" type="checkbox" />
      </td>
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
