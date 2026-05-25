import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { parsePublishedConfigSnapshot } from "../services/published-config-reader.server";
import { readPublishedConfigMetafield } from "../services/shopify-config.server";

const formatBytes = (bytes: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(bytes);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const metafield = await readPublishedConfigMetafield(admin);
  const parsedConfig = parsePublishedConfigSnapshot(metafield?.value);

  return {
    metafield,
    parsedConfig,
  };
};

export default function ConfigViewerPage() {
  const { metafield, parsedConfig } = useLoaderData<typeof loader>();
  const payload = parsedConfig.payload;
  const previewRecords = payload?.pincodeData.records.slice(0, 25) ?? [];

  return (
    <s-page heading="Config viewer">
      <s-section heading="Published Shopify config">
        <div style={{ display: "grid", gap: "1rem" }}>
          <p>
            This page reads the published shop metafield only. It does not write
            config and does not change checkout behavior.
          </p>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            }}
          >
            <SummaryBox label="Status" value={parsedConfig.status} />
            <SummaryBox
              label="Payload bytes"
              value={formatBytes(parsedConfig.payloadSizeBytes)}
            />
            <SummaryBox label="Schema" value={payload?.v ?? "n/a"} />
            <SummaryBox
              label="Records"
              value={payload?.pincodeData.records.length ?? 0}
            />
          </div>

          {metafield && (
            <p>
              Metafield ID: <strong>{metafield.id}</strong>. Updated at:{" "}
              <strong>{metafield.updatedAt}</strong>.
            </p>
          )}

          {parsedConfig.errors.length > 0 && (
            <MessageList title="Errors" items={parsedConfig.errors} />
          )}
          {parsedConfig.warnings.length > 0 && (
            <MessageList title="Warnings" items={parsedConfig.warnings} />
          )}
        </div>
      </s-section>

      {payload && (
        <s-section heading="Parsed summary">
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p>
              Kind: <strong>{payload.kind}</strong>
            </p>
            <p>
              Published at: <strong>{payload.publishedAt}</strong>
            </p>
            <p>
              Source: <strong>{payload.source.filename}</strong> (
              {payload.source.batchId})
            </p>
          </div>
        </s-section>
      )}

      <s-section heading="Record preview">
        {previewRecords.length === 0 ? (
          <s-paragraph>No pincode records are available to preview.</s-paragraph>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: "72rem" }}>
              <thead>
                <tr>
                  {[
                    "Pincode",
                    "State",
                    "District",
                    "Location",
                    "Area group",
                    "Delivery",
                    "Same day",
                    "Next day",
                    "Product availability",
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
                {previewRecords.map((record, index) => (
                  <tr key={`${record.pc}-${index}`}>
                    <Cell>{record.pc}</Cell>
                    <Cell>{record.st}</Cell>
                    <Cell>{record.di}</Cell>
                    <Cell>{record.ln}</Cell>
                    <Cell>{record.ag}</Cell>
                    <Cell>{record.da}</Cell>
                    <Cell>{record.sd}</Cell>
                    <Cell>{record.nd}</Cell>
                    <Cell>{record.pa}</Cell>
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

function SummaryBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        border: "1px solid #d8ddd2",
        borderRadius: "8px",
        padding: "0.75rem",
      }}
    >
      <strong style={{ display: "block", fontSize: "1.1rem" }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function MessageList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
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
