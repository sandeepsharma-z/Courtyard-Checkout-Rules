import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { parsePincodeCsv } from "../services/csv-import.server";
import {
  approvePincodeImportBatch,
  createPincodeImportBatch,
  getImportBatchForPreview,
  getRecentImportBatches,
} from "../services/pincode-storage.server";

const parseJsonList = (value: string) => JSON.parse(value) as string[];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const batchId = url.searchParams.get("batchId") ?? undefined;
  const [batch, recentBatches] = await Promise.all([
    getImportBatchForPreview(batchId),
    getRecentImportBatches(),
  ]);

  return {
    batch,
    recentBatches,
    missingHeaders: batch ? parseJsonList(batch.missingHeadersJson) : [],
    extraHeaders: batch ? parseJsonList(batch.extraHeadersJson) : [],
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "approve") {
    const batchId = String(formData.get("batchId") ?? "");
    if (!batchId) {
      throw new Response("Missing import batch ID.", { status: 400 });
    }

    await approvePincodeImportBatch(batchId);
    return redirect(`/app/import?batchId=${batchId}`);
  }

  const file = formData.get("csvFile");
  if (!(file instanceof File) || file.size === 0) {
    throw new Response("Please upload a CSV file.", { status: 400 });
  }

  const csvText = await file.text();
  const parsedImport = parsePincodeCsv(csvText, file.name || "uploaded.csv");
  const batch = await createPincodeImportBatch(parsedImport);

  return redirect(`/app/import?batchId=${batch.id}`);
};

export default function ImportPage() {
  const { batch, recentBatches, missingHeaders, extraHeaders } =
    useLoaderData<typeof loader>();
  const previewRows = batch?.records ?? [];
  const canApprove =
    batch && batch.status !== "approved" && batch.validRows > 0;

  return (
    <s-page heading="CSV import">
      <s-section heading="Upload pincode CSV">
        <Form method="post" encType="multipart/form-data">
          <input type="hidden" name="intent" value="upload" />
          <div style={{ display: "grid", gap: "1rem", maxWidth: "44rem" }}>
            <label style={{ display: "grid", gap: "0.5rem" }}>
              <strong>CSV file</strong>
              <input accept=".csv,text/csv" name="csvFile" type="file" />
            </label>
            <button type="submit">Upload and preview</button>
          </div>
        </Form>
      </s-section>

      {batch && (
        <s-section heading="Import preview">
          <div style={{ display: "grid", gap: "1rem" }}>
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              }}
            >
              <SummaryBox label="Total rows" value={batch.totalRows} />
              <SummaryBox label="Valid" value={batch.validRows} />
              <SummaryBox label="Invalid" value={batch.invalidRows} />
              <SummaryBox label="Duplicate" value={batch.duplicateRows} />
            </div>

            {(missingHeaders.length > 0 || extraHeaders.length > 0) && (
              <div>
                {missingHeaders.length > 0 && (
                  <p>
                    <strong>Missing headers:</strong>{" "}
                    {missingHeaders.join(", ")}
                  </p>
                )}
                {extraHeaders.length > 0 && (
                  <p>
                    <strong>Extra headers:</strong> {extraHeaders.join(", ")}
                  </p>
                )}
              </div>
            )}

            <p>
              Previewing first {previewRows.length} stored rows from{" "}
              <strong>{batch.filename}</strong>. All CSV values are stored as
              strings. Invalid and duplicate rows are stored for review but are
              not active configuration.
            </p>

            {canApprove && (
              <Form method="post">
                <input type="hidden" name="intent" value="approve" />
                <input type="hidden" name="batchId" value={batch.id} />
                <button type="submit">Approve valid rows</button>
              </Form>
            )}

            {batch.status === "approved" && (
              <p>
                <strong>Status:</strong> Approved. Valid rows from this batch
                are the current local configurable pincode dataset.
              </p>
            )}

            <PreviewTable rows={previewRows} />
          </div>
        </s-section>
      )}

      <s-section heading="Recent imports">
        {recentBatches.length === 0 ? (
          <s-paragraph>No CSV imports have been uploaded yet.</s-paragraph>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {recentBatches.map((recentBatch) => (
              <a
                href={`/app/import?batchId=${recentBatch.id}`}
                key={recentBatch.id}
              >
                {recentBatch.filename} - {recentBatch.status} -{" "}
                {recentBatch.totalRows} rows
              </a>
            ))}
          </div>
        )}
      </s-section>
    </s-page>
  );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid #d8ddd2",
        borderRadius: "8px",
        padding: "0.75rem",
      }}
    >
      <strong style={{ display: "block", fontSize: "1.35rem" }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PreviewTable({
  rows,
}: {
  rows: NonNullable<Awaited<ReturnType<typeof getImportBatchForPreview>>>["records"];
}) {
  if (rows.length === 0) {
    return <p>No rows available for preview.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: "90rem" }}>
        <thead>
          <tr>
            {[
              "Row",
              "Status",
              "Errors",
              "State",
              "District",
              "Pincode",
              "Location",
              "Area group",
              "Delivery",
              "Same day",
              "Next day",
              "Product availability",
              "Remarks",
              "Charges text",
              "Updated same day",
              "Updated next day",
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
          {rows.map((row) => (
            <tr key={row.id}>
              <Cell>{row.rowNumber}</Cell>
              <Cell>{row.rowStatus}</Cell>
              <Cell>{parseJsonList(row.rowErrorsJson).join("; ")}</Cell>
              <Cell>{row.state}</Cell>
              <Cell>{row.district}</Cell>
              <Cell>{row.pincode}</Cell>
              <Cell>{row.locationName}</Cell>
              <Cell>{row.areaGroup}</Cell>
              <Cell>{row.deliveryAvailability}</Cell>
              <Cell>{row.sameDayDeliveryRule}</Cell>
              <Cell>{row.nextDayDeliveryRule}</Cell>
              <Cell>{row.productAvailabilityRule}</Cell>
              <Cell>{row.remarks}</Cell>
              <Cell>{row.chargesPricingText}</Cell>
              <Cell>{row.updatedSameDayRule}</Cell>
              <Cell>{row.updatedNextDayRule}</Cell>
            </tr>
          ))}
        </tbody>
      </table>
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
