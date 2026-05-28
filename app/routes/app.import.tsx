import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { parsePincodeCsv } from "../services/csv-import.server";
import {
  approvePincodeImportBatch,
  createPincodeImportBatch,
  generateAutoRulesFromBatch,
  getImportBatchForPreview,
  getRecentImportBatches,
  previewAutoRulesFromBatch,
} from "../services/pincode-storage.server";

const parseJsonList = (value: string) => JSON.parse(value) as string[];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const batchId = url.searchParams.get("batchId") ?? undefined;
  const rulesCreated = Number(url.searchParams.get("rulesCreated") ?? "0");

  const [batch, recentBatches] = await Promise.all([
    getImportBatchForPreview(batchId),
    getRecentImportBatches(),
  ]);

  const autoRulePreview =
    batchId && batch && batch.status !== "approved"
      ? await previewAutoRulesFromBatch(batchId)
      : [];

  return {
    batch,
    recentBatches,
    autoRulePreview,
    rulesCreated,
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
    const rulesCreated = await generateAutoRulesFromBatch(batchId);
    return redirect(
      `/app/import?batchId=${batchId}&rulesCreated=${rulesCreated}`,
    );
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
  const {
    batch,
    recentBatches,
    autoRulePreview,
    rulesCreated,
    missingHeaders,
    extraHeaders,
  } = useLoaderData<typeof loader>();
  const previewRows = batch?.records ?? [];
  const canApprove =
    batch && batch.status !== "approved" && batch.validRows > 0;

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-topbar-left">
            <Link className="bsure-back" to="/app">
              &#8592;
            </Link>
            <strong className="bsure-topbar-title">Pincode CSV import</strong>
          </div>
        </div>

        <div className="bsure-rule-shell">
          {rulesCreated > 0 && (
            <div className="import-banner import-banner-success">
              <strong>{rulesCreated} rules auto-created</strong> from imported
              delivery text. Rename rules are auto-enabled only when exactly one
              enabled shipping method mapping exists; otherwise they stay
              inactive for review.{" "}
              <Link to="/app/shipping-rules">View shipping rules</Link> &middot;{" "}
              <Link to="/app/product-restrictions">
                View product restrictions
              </Link>
            </div>
          )}

          <div className="bsure-card">
            <div className="bsure-card-header">
              <h2>Upload pincode CSV</h2>
            </div>
            <div className="bsure-card-body">
              <Form method="post" encType="multipart/form-data">
                <input type="hidden" name="intent" value="upload" />
                <div className="import-upload-row">
                  <label className="bsure-label">
                    CSV file
                    <input
                      accept=".csv,text/csv"
                      className="bsure-input import-file-input"
                      name="csvFile"
                      type="file"
                    />
                  </label>
                  <button className="bsure-button" type="submit">
                    Upload and preview
                  </button>
                </div>
              </Form>
            </div>
          </div>

          {batch && (
            <>
              <div className="bsure-card">
                <div className="bsure-card-header">
                  <h2>Import summary — {batch.filename}</h2>
                  {batch.status === "approved" && (
                    <span className="rules-status active">Approved</span>
                  )}
                </div>
                <div className="bsure-card-body">
                  <div className="import-summary-grid">
                    <SummaryBox label="Total rows" value={batch.totalRows} />
                    <SummaryBox
                      label="Valid"
                      value={batch.validRows}
                      color="green"
                    />
                    <SummaryBox
                      label="Invalid"
                      value={batch.invalidRows}
                      color={batch.invalidRows > 0 ? "red" : undefined}
                    />
                    <SummaryBox
                      label="Duplicate"
                      value={batch.duplicateRows}
                      color={batch.duplicateRows > 0 ? "orange" : undefined}
                    />
                  </div>

                  {(missingHeaders.length > 0 || extraHeaders.length > 0) && (
                    <div className="import-header-warnings">
                      {missingHeaders.length > 0 && (
                        <p className="import-warning">
                          <strong>Missing headers:</strong>{" "}
                          {missingHeaders.join(", ")}
                        </p>
                      )}
                      {extraHeaders.length > 0 && (
                        <p className="import-info">
                          <strong>Unrecognised headers (ignored):</strong>{" "}
                          {extraHeaders.join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="import-note">
                    Showing first {previewRows.length} rows from the uploaded
                    file. Invalid and duplicate rows are stored for reference
                    but will not be activated.
                  </p>

                  <PreviewTable rows={previewRows} />
                </div>
              </div>

              {autoRulePreview.length > 0 && (
                <div className="bsure-card">
                  <div className="bsure-card-header">
                    <h2>Rules that will be auto-created</h2>
                  </div>
                  <div className="bsure-card-body">
                    <p className="import-note">
                      After approval these rules will be created automatically
                      from imported columns. Shipping rename rules need one
                      enabled shipping method mapping before they can be safely
                      enabled. Payment, cutoff, product tag, and shipping method
                      names are not inferred unless they exist in imported data
                      or admin configuration.
                    </p>
                    <table className="rules-table">
                      <thead>
                        <tr>
                          <th>Rule name</th>
                          <th>Type</th>
                          <th>Publish state</th>
                          <th>Description</th>
                          <th>Pincodes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {autoRulePreview.map((rule, i) => (
                          <tr className="rules-row" key={i}>
                            <td>{rule.name}</td>
                            <td>
                              <span
                                className={`rules-status ${rule.type === "ShippingHide" ? "deactivated" : rule.type === "ProductRestriction" ? "deactivated" : "active"}`}
                              >
                                {rule.type === "ShippingHide"
                                  ? "Shipping Hide"
                                  : rule.type === "ShippingRename"
                                    ? "Shipping Rename"
                                    : "Product Block"}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`rules-status ${rule.willAutoEnable ? "active" : "deactivated"}`}
                              >
                                {rule.willAutoEnable
                                  ? "Auto-enabled"
                                  : "Needs review"}
                              </span>
                            </td>
                            <td>{rule.description}</td>
                            <td>{rule.pincodes.length} pincodes</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {canApprove && (
                <div className="bsure-card">
                  <div className="bsure-card-header">
                    <h2>Approve import</h2>
                  </div>
                  <div className="bsure-card-body">
                    <p className="import-note">
                      Approving will activate {batch.validRows} valid pincode
                      records and
                      {autoRulePreview.length > 0
                        ? ` auto-create ${autoRulePreview.length} rules`
                        : " update the active pincode dataset"}
                      . Any previously approved batch will be deactivated.
                    </p>
                    <Form method="post">
                      <input type="hidden" name="intent" value="approve" />
                      <input type="hidden" name="batchId" value={batch.id} />
                      <button className="bsure-button" type="submit">
                        Approve and generate rules
                      </button>
                    </Form>
                  </div>
                </div>
              )}

              {batch.status === "approved" && rulesCreated === 0 && (
                <div className="import-banner import-banner-info">
                  This batch is already approved. {batch.validRows} pincode
                  records are active.
                </div>
              )}
            </>
          )}

          {recentBatches.length > 0 && (
            <div className="bsure-card">
              <div className="bsure-card-header">
                <h2>Recent imports</h2>
              </div>
              <div className="bsure-card-body">
                <table className="rules-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Status</th>
                      <th>Total rows</th>
                      <th>Valid</th>
                      <th>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBatches.map((b) => (
                      <tr className="rules-row" key={b.id}>
                        <td>
                          <a
                            className="rules-name-link"
                            href={`/app/import?batchId=${b.id}`}
                          >
                            {b.filename}
                          </a>
                        </td>
                        <td>
                          <span
                            className={`rules-status ${b.status === "approved" ? "active" : "deactivated"}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td>{b.totalRows}</td>
                        <td>{b.validRows}</td>
                        <td>
                          {new Date(b.createdAt).toLocaleDateString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "red" | "orange";
}) {
  const colorMap = { green: "#008060", red: "#d82c0d", orange: "#e07800" };
  return (
    <div className="import-summary-box">
      <strong style={{ color: color ? colorMap[color] : "#202223" }}>
        {value}
      </strong>
      <span>{label}</span>
    </div>
  );
}

function PreviewTable({
  rows,
}: {
  rows: NonNullable<
    Awaited<ReturnType<typeof getImportBatchForPreview>>
  >["records"];
}) {
  if (rows.length === 0) {
    return <p className="import-note">No rows available for preview.</p>;
  }

  const cols = [
    "Row",
    "Status",
    "Errors",
    "State",
    "District",
    "Pincode",
    "Location name",
    "Area group",
    "Delivery",
    "Same day",
    "Next day",
    "Product avail.",
    "Remarks",
    "Charges",
    "Upd. same day",
    "Upd. next day",
  ];

  return (
    <div className="import-table-scroll">
      <table className="rules-table import-preview-table">
        <thead>
          <tr>
            {cols.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="rules-row" key={row.id}>
              <td>{row.rowNumber}</td>
              <td>
                <span
                  className={`rules-status ${row.rowStatus === "valid" ? "active" : "deactivated"}`}
                >
                  {row.rowStatus}
                </span>
              </td>
              <td className="import-error-cell">
                {parseJsonList(row.rowErrorsJson).join("; ")}
              </td>
              <td>{row.state}</td>
              <td>{row.district}</td>
              <td>
                <code>{row.pincode}</code>
              </td>
              <td>{row.locationName}</td>
              <td>{row.areaGroup}</td>
              <td>{row.deliveryAvailability}</td>
              <td>{row.sameDayDeliveryRule}</td>
              <td>{row.nextDayDeliveryRule}</td>
              <td>{row.productAvailabilityRule}</td>
              <td>{row.remarks}</td>
              <td>{row.chargesPricingText}</td>
              <td>{row.updatedSameDayRule}</td>
              <td>{row.updatedNextDayRule}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
