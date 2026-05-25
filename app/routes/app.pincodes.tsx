import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getActivePincodeSummary } from "../services/pincode-storage.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return getActivePincodeSummary();
};

export default function PincodeGroupsPage() {
  const { activeCount, recentRecords, approvedBatch } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Pincode data">
      <s-section heading="Current local configuration">
        <div style={{ display: "grid", gap: "1rem" }}>
          <p>
            <strong>{activeCount}</strong> active pincode records are available
            in local configurable storage.
          </p>
          {approvedBatch ? (
            <p>
              Current approved batch: <strong>{approvedBatch.filename}</strong>
            </p>
          ) : (
            <p>No approved CSV import batch exists yet.</p>
          )}
        </div>
      </s-section>

      <s-section heading="Active record preview">
        {recentRecords.length === 0 ? (
          <s-paragraph>
            Approve a CSV import batch to populate active pincode records.
          </s-paragraph>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: "56rem" }}>
              <thead>
                <tr>
                  {[
                    "Pincode",
                    "State",
                    "District",
                    "Location",
                    "Area group",
                    "Delivery availability",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        borderBottom: "1px solid #d8ddd2",
                        padding: "0.5rem",
                        textAlign: "left",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((record) => (
                  <tr key={record.id}>
                    <Cell>{record.pincode}</Cell>
                    <Cell>{record.state}</Cell>
                    <Cell>{record.district}</Cell>
                    <Cell>{record.locationName}</Cell>
                    <Cell>{record.areaGroup}</Cell>
                    <Cell>{record.deliveryAvailability}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        borderBottom: "1px solid #edf0e8",
        padding: "0.5rem",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
