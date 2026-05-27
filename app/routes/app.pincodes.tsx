import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getActivePincodeSummary } from "../services/pincode-storage.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return getActivePincodeSummary();
};

export default function PincodeGroupsPage() {
  const { activeCount, approvedBatch, recentRecords } = useLoaderData<typeof loader>();

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <Link className="bsure-back" to="/app">←</Link>
            <h1>Pincode groups</h1>
          </div>
          <Link className="bsure-more" to="/app/import">Import CSV</Link>
        </div>

        <div className="bsure-flow">
          <section className="bsure-card">
            <h2>Current local configuration</h2>
            <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "28px", fontWeight: 700, color: "#202223" }}>{activeCount}</span>
                <span style={{ color: "#5c5f62" }}>active pincode records in local configurable storage</span>
              </div>
              {approvedBatch ? (
                <div className="bsure-rule-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{approvedBatch.filename}</div>
                    <div className="bsure-rule-meta">Current approved batch</div>
                  </div>
                  <Link className="bsure-button secondary" to="/app/publish">Review publish status</Link>
                </div>
              ) : (
                <div style={{ padding: "14px", background: "#fafafa", border: "1px dashed #d4d4d4", borderRadius: "8px", color: "#5c5f62", fontSize: "14px" }}>
                  No approved CSV import batch yet. <Link style={{ color: "#008060" }} to="/app/import">Import a CSV</Link> to populate pincode records.
                </div>
              )}
            </div>
          </section>

          {recentRecords.length > 0 && (
            <section className="bsure-card">
              <h2>Active record preview</h2>
              <p style={{ marginTop: "4px", marginBottom: "14px" }}>Showing first {recentRecords.length} records from approved batch.</p>
              <div style={{ overflowX: "auto", border: "1px solid #e1e3e5", borderRadius: "8px" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "640px" }}>
                  <thead>
                    <tr>
                      {["Pincode", "State", "District", "Location", "Area group", "Delivery availability"].map((h) => (
                        <th key={h} style={{ background: "#fafafa", borderBottom: "1px solid #e1e3e5", color: "#303030", fontSize: "13px", fontWeight: 650, padding: "10px 14px", textAlign: "left" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentRecords.map((record) => (
                      <tr key={record.id} style={{ transition: "background 140ms" }}>
                        <Td>{record.pincode}</Td>
                        <Td>{record.state}</Td>
                        <Td>{record.district}</Td>
                        <Td>{record.locationName}</Td>
                        <Td>{record.areaGroup}</Td>
                        <Td>{record.deliveryAvailability}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ borderTop: "1px solid #e1e3e5", color: "#202223", fontSize: "13px", padding: "10px 14px", verticalAlign: "top" }}>
      {children}
    </td>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
