import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  buildPublishedConfigSnapshot,
  createPublishHistoryRecord,
  deletePublishHistorySnapshot,
  getPublishHistory,
  getPublishHistorySnapshot,
} from "../services/published-config.server";
import {
  enableDeliveryCustomization,
  enableCheckoutValidation,
  enablePaymentCustomization,
  getCheckoutValidationStatus,
  getDeliveryCustomizationStatus,
  getPaymentCustomizationStatus,
  getShopIdentity,
  publishConfigMetafield,
} from "../services/shopify-config.server";
import { PUBLISHED_CONFIG_SCHEMA_VERSION } from "../types/published-config";

type ActionResult = {
  status: "success" | "error";
  message: string;
};

const formatBytes = (bytes: number) =>
  new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(bytes);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const [
    snapshot,
    history,
    validationStatus,
    deliveryCustomizationStatus,
    paymentCustomizationStatus,
  ] = await Promise.all([
    buildPublishedConfigSnapshot(),
    getPublishHistory(),
    getCheckoutValidationStatus(admin).catch((error) => ({
      title: "Courtyard Checkout Validation",
      handle: "courtyard-checkout-validation",
      validation: null,
      isActive: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to read checkout validation status.",
    })),
    getDeliveryCustomizationStatus(admin).catch((error) => ({
      title: "Courtyard Delivery Customization",
      handle: "courtyard-delivery-customization",
      deliveryCustomization: null,
      isActive: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to read delivery customization status.",
    })),
    getPaymentCustomizationStatus(admin).catch((error) => ({
      title: "Courtyard Payment Customization",
      handle: "courtyard-payment-customization",
      paymentCustomization: null,
      isActive: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to read payment customization status.",
    })),
  ]);

  return {
    snapshot,
    history,
    validationStatus,
    deliveryCustomizationStatus,
    paymentCustomizationStatus,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const shop = await getShopIdentity(admin);

  try {
    if (intent === "deleteSnapshot") {
      const snapshotId = String(formData.get("snapshotId") ?? "");
      if (!snapshotId) {
        return {
          status: "error",
          message: "Missing snapshot ID.",
        } satisfies ActionResult;
      }

      await deletePublishHistorySnapshot(snapshotId);

      return {
        status: "success",
        message:
          "Publish history entry was deleted locally. Shopify metafield configuration was not changed.",
      } satisfies ActionResult;
    }

    if (intent === "enableCheckoutValidation") {
      const result = await enableCheckoutValidation(admin);

      return {
        status: "success",
        message: `Checkout validation was ${result.action} and enabled for this Shopify app installation.`,
      } satisfies ActionResult;
    }

    if (intent === "enableDeliveryCustomization") {
      const result = await enableDeliveryCustomization(admin);

      return {
        status: "success",
        message: `Delivery customization was ${result.action} and enabled for this Shopify app installation.`,
      } satisfies ActionResult;
    }

    if (intent === "enablePaymentCustomization") {
      const result = await enablePaymentCustomization(admin);

      return {
        status: "success",
        message: `Payment customization was ${result.action} and enabled for this Shopify app installation.`,
      } satisfies ActionResult;
    }

    if (intent === "republish") {
      const snapshotId = String(formData.get("snapshotId") ?? "");
      const previousSnapshot = await getPublishHistorySnapshot(snapshotId);

      if (!previousSnapshot) {
        return {
          status: "error",
          message: "Previous published snapshot was not found.",
        } satisfies ActionResult;
      }

      const result = await publishConfigMetafield({
        admin,
        ownerId: shop.id,
        payloadJson: previousSnapshot.payloadJson,
      });

      await createPublishHistoryRecord({
        schemaVersion: previousSnapshot.schemaVersion,
        status: "republished",
        shop: shop.myshopifyDomain,
        metafieldId: result.metafieldId,
        sourceBatchId: previousSnapshot.sourceBatchId,
        sourceFilename: previousSnapshot.sourceFilename,
        recordCount: previousSnapshot.recordCount,
        payloadSizeBytes: previousSnapshot.payloadSizeBytes,
        payloadJson: previousSnapshot.payloadJson,
        message: `Republished previous snapshot ${previousSnapshot.id}.`,
        publishedAt: new Date(),
      });

      return {
        status: "success",
        message: "Previous snapshot was republished to Shopify configuration.",
      } satisfies ActionResult;
    }

    const snapshot = await buildPublishedConfigSnapshot();

    if (!snapshot) {
      return {
        status: "error",
        message: "Could not build configuration snapshot. Check that rules are configured.",
      } satisfies ActionResult;
    }

    if (snapshot.isTooLarge) {
      await createPublishHistoryRecord({
        schemaVersion: PUBLISHED_CONFIG_SCHEMA_VERSION,
        status: "blocked_too_large",
        shop: shop.myshopifyDomain,
        sourceBatchId: snapshot.sourceBatchId,
        sourceFilename: snapshot.sourceFilename,
        recordCount: snapshot.recordCount,
        payloadSizeBytes: snapshot.payloadSizeBytes,
        payloadJson: snapshot.payloadJson,
        message:
          "Payload exceeded the current single-metafield publish guard. Use a future chunked config strategy.",
      });

      return {
        status: "error",
        message: `Publish blocked. Payload is ${formatBytes(
          snapshot.payloadSizeBytes,
        )} bytes, which exceeds the current single-metafield guard of ${formatBytes(
          snapshot.maxBytes,
        )} bytes. Future chunked metafields or metaobjects are recommended for large datasets.`,
      } satisfies ActionResult;
    }

    const result = await publishConfigMetafield({
      admin,
      ownerId: shop.id,
      payloadJson: snapshot.payloadJson,
    });

    await createPublishHistoryRecord({
      schemaVersion: PUBLISHED_CONFIG_SCHEMA_VERSION,
      status: "published",
      shop: shop.myshopifyDomain,
      metafieldId: result.metafieldId,
      sourceBatchId: snapshot.sourceBatchId,
      sourceFilename: snapshot.sourceFilename,
      recordCount: snapshot.recordCount,
      payloadSizeBytes: snapshot.payloadSizeBytes,
      payloadJson: snapshot.payloadJson,
      message: "Published current approved local pincode configuration.",
      publishedAt: new Date(),
    });

    return {
      status: "success",
      message: "Approved local pincode configuration was published to Shopify.",
    } satisfies ActionResult;
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Publish failed.",
    } satisfies ActionResult;
  }
};

export default function PublishPage() {
  const {
    snapshot,
    history,
    validationStatus,
    deliveryCustomizationStatus,
    paymentCustomizationStatus,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionResult | undefined;

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        {/* Topbar */}
        <div className="bsure-topbar">
          <div className="bsure-title"><h1>Publish config</h1></div>
        </div>

        {/* Action result banner */}
        {actionData && (
          <div style={{
            marginTop: "14px",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "14px",
            background: actionData.status === "success" ? "#e3f1df" : "#fce8e8",
            border: `1px solid ${actionData.status === "success" ? "#aee9d1" : "#f5c0c0"}`,
            color: actionData.status === "success" ? "#1a5c35" : "#8a1a1a",
          }}>
            <strong>{actionData.status === "success" ? "✓ Success" : "✗ Error"}:</strong>{" "}
            {actionData.message}
          </div>
        )}

        {/* Publish CTA card */}
        {snapshot && !snapshot.isTooLarge && (
          <div style={{
            marginTop: "16px",
            background: "#f0faf4",
            border: "1px solid #aee9d1",
            borderRadius: "12px",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "15px", color: "#1a5c35" }}>
                Ready to publish
              </div>
              <div style={{ fontSize: "13px", color: "#5c7a6a", marginTop: "2px" }}>
                {formatBytes(snapshot.payloadSizeBytes)} bytes · {snapshot.recordCount} records · {snapshot.sourceFilename}
              </div>
            </div>
            <Form method="post">
              <input type="hidden" name="intent" value="publish" />
              <button type="submit" style={{
                background: "#1a7a4a", color: "#fff",
                border: "none", borderRadius: "8px",
                padding: "10px 22px", fontSize: "14px",
                fontWeight: 600, cursor: "pointer",
              }}>
                Publish config →
              </button>
            </Form>
          </div>
        )}

        {/* Functions status */}
        <div style={{ marginTop: "20px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 12px" }}>
            Function activation status
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            <FunctionCard
              title="Delivery customization"
              icon="🚚"
              isActive={deliveryCustomizationStatus.isActive}
              functionName={deliveryCustomizationStatus.deliveryCustomization?.shopifyFunction.title}
              id={deliveryCustomizationStatus.deliveryCustomization?.id}
              effectLabel="Checkout effect"
              enableIntent="enableDeliveryCustomization"
              enableLabel="Enable delivery customization"
            />
            <FunctionCard
              title="Payment customization"
              icon="💳"
              isActive={paymentCustomizationStatus.isActive}
              functionName={paymentCustomizationStatus.paymentCustomization?.shopifyFunction.title}
              id={paymentCustomizationStatus.paymentCustomization?.id}
              effectLabel="Checkout effect"
              enableIntent="enablePaymentCustomization"
              enableLabel="Enable payment customization"
            />
            <FunctionCard
              title="Checkout validation"
              icon="✅"
              isActive={validationStatus.isActive}
              functionName={validationStatus.validation?.shopifyFunction.title}
              id={validationStatus.validation?.id}
              effectLabel="Block on failure"
              enableIntent="enableCheckoutValidation"
              enableLabel="Enable checkout validation"
            />
          </div>
        </div>

        {/* Publish history */}
        {history.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 12px" }}>
              Publish history
            </h2>
            <div style={{ display: "grid", gap: "8px" }}>
              {history.map((entry) => (
                <div key={entry.id} style={{
                  background: "#fff",
                  border: "1px solid #e3e3e3",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "2px 8px",
                        borderRadius: "12px",
                        background: entry.status === "published" || entry.status === "republished" ? "#e3f1df" : "#fff3e0",
                        color: entry.status === "published" || entry.status === "republished" ? "#1a5c35" : "#7a4a00",
                      }}>
                        {entry.status}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1a1a" }}>
                        {entry.sourceFilename || "stored snapshot"}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6d7175", marginTop: "4px" }}>
                      {entry.recordCount} records · {formatBytes(entry.payloadSizeBytes)} bytes · schema v{entry.schemaVersion}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    {(entry.status === "published" || entry.status === "republished") && (
                      <Form method="post">
                        <input type="hidden" name="intent" value="republish" />
                        <input type="hidden" name="snapshotId" value={entry.id} />
                        <button type="submit" style={{
                          background: "#f3f3f3", border: "1px solid #ddd",
                          borderRadius: "6px", padding: "6px 12px",
                          fontSize: "12px", cursor: "pointer", color: "#333",
                        }}>
                          Republish
                        </button>
                      </Form>
                    )}
                    <Form method="post">
                      <input type="hidden" name="intent" value="deleteSnapshot" />
                      <input type="hidden" name="snapshotId" value={entry.id} />
                      <button type="submit" style={{
                        background: "#fff0f0", border: "1px solid #f5c0c0",
                        borderRadius: "6px", padding: "6px 12px",
                        fontSize: "12px", cursor: "pointer", color: "#c0392b",
                      }}>
                        Delete
                      </button>
                    </Form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FunctionCard({
  title, icon, isActive, functionName, id, effectLabel, enableIntent, enableLabel,
}: {
  title: string; icon: string; isActive: boolean;
  functionName?: string; id?: string;
  effectLabel: string; enableIntent: string; enableLabel: string;
}) {
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${isActive ? "#aee9d1" : "#e3e3e3"}`,
      borderRadius: "12px",
      padding: "16px",
      display: "flex", flexDirection: "column", gap: "8px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "18px" }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: "14px", color: "#1a1a1a" }}>{title}</span>
        <span style={{
          marginLeft: "auto", fontSize: "11px", fontWeight: 600,
          padding: "2px 8px", borderRadius: "12px",
          background: isActive ? "#e3f1df" : "#f5f5f5",
          color: isActive ? "#1a5c35" : "#6d7175",
        }}>
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>
      {functionName && (
        <div style={{ fontSize: "12px", color: "#6d7175" }}>
          {functionName}
        </div>
      )}
      <div style={{ fontSize: "12px", color: isActive ? "#1a5c35" : "#6d7175" }}>
        {effectLabel}: <strong>{isActive ? "Enabled" : "Not enabled"}</strong>
      </div>
      {id && (
        <div style={{ fontSize: "11px", color: "#aaa", wordBreak: "break-all" }}>
          ID: {id}
        </div>
      )}
      {!isActive && (
        <Form method="post" style={{ marginTop: "4px" }}>
          <input type="hidden" name="intent" value={enableIntent} />
          <button type="submit" style={{
            width: "100%", background: "#1a7a4a", color: "#fff",
            border: "none", borderRadius: "6px",
            padding: "8px 12px", fontSize: "12px",
            fontWeight: 600, cursor: "pointer",
          }}>
            {enableLabel}
          </button>
        </Form>
      )}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
