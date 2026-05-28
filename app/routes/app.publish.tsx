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
  getCheckoutValidationStatus,
  getDeliveryCustomizationStatus,
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

  const [snapshot, history, validationStatus, deliveryCustomizationStatus] =
    await Promise.all([
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
  ]);

  return {
    snapshot,
    history,
    validationStatus,
    deliveryCustomizationStatus,
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
        message: "No approved active pincode configuration is available.",
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
  } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionResult | undefined;

  return (
    <s-page heading="Publish config">
      <s-section heading="Single metafield snapshot">
        <div style={{ display: "grid", gap: "1rem" }}>
          <p>
            Phase 4 publishes the approved local pincode dataset to one
            shop-level JSON metafield. This does not add Shopify Functions and
            does not change checkout behavior.
          </p>
          <p>
            Target: <strong>courtyard_checkout_rules.published_config</strong>
          </p>
          {actionData && (
            <p>
              <strong>
                {actionData.status === "success" ? "Success" : "Error"}:
              </strong>{" "}
              {actionData.message}
            </p>
          )}
        </div>
      </s-section>

      <s-section heading="Delivery customization activation">
        <div style={{ display: "grid", gap: "1rem" }}>
          <p>
            Shipping method hide and rename behavior only works after the
            delivery customization Function is deployed and enabled for this
            store. This is separate from checkout validation.
          </p>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            }}
          >
            <SummaryBox
              label="Status"
              value={deliveryCustomizationStatus.isActive ? "Active" : "Inactive"}
            />
            <SummaryBox
              label="Function"
              value={
                deliveryCustomizationStatus.deliveryCustomization
                  ?.shopifyFunction.title ?? "n/a"
              }
            />
            <SummaryBox
              label="Checkout effect"
              value={
                deliveryCustomizationStatus.isActive ? "Enabled" : "No"
              }
            />
          </div>
          {"error" in deliveryCustomizationStatus &&
            deliveryCustomizationStatus.error && (
              <p>
                <strong>Status error:</strong>{" "}
                {deliveryCustomizationStatus.error}
              </p>
            )}
          {deliveryCustomizationStatus.deliveryCustomization && (
            <p>
              Delivery customization ID:{" "}
              <strong>
                {deliveryCustomizationStatus.deliveryCustomization.id}
              </strong>
            </p>
          )}
          {!deliveryCustomizationStatus.isActive && (
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="enableDeliveryCustomization"
              />
              <button type="submit">Enable delivery customization</button>
            </Form>
          )}
        </div>
      </s-section>

      <s-section heading="Checkout validation activation">
        <div style={{ display: "grid", gap: "1rem" }}>
          <p>
            Product validation rules only block checkout after the checkout
            validation Function is deployed and enabled for this store. Saving a
            rule and publishing config alone will not activate checkout
            blocking.
          </p>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            }}
          >
            <SummaryBox
              label="Status"
              value={validationStatus.isActive ? "Active" : "Inactive"}
            />
            <SummaryBox
              label="Function"
              value={validationStatus.validation?.shopifyFunction.title ?? "n/a"}
            />
            <SummaryBox
              label="Block on failure"
              value={
                validationStatus.validation?.blockOnFailure ? "Enabled" : "No"
              }
            />
          </div>
          {"error" in validationStatus && validationStatus.error && (
            <p>
              <strong>Status error:</strong> {validationStatus.error}
            </p>
          )}
          {validationStatus.validation && (
            <p>
              Validation ID: <strong>{validationStatus.validation.id}</strong>
            </p>
          )}
          {!validationStatus.isActive && (
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="enableCheckoutValidation"
              />
              <button type="submit">Enable checkout validation</button>
            </Form>
          )}
        </div>
      </s-section>

      <s-section heading="Current snapshot preview">
        {!snapshot ? (
          <s-paragraph>
            No approved active pincode records are available to publish.
          </s-paragraph>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              }}
            >
              <SummaryBox label="Schema version" value={snapshot.payload.v} />
              <SummaryBox label="Records" value={snapshot.recordCount} />
              <SummaryBox
                label="Payload bytes"
                value={formatBytes(snapshot.payloadSizeBytes)}
              />
              <SummaryBox
                label="Single-field guard"
                value={formatBytes(snapshot.maxBytes)}
              />
            </div>

            <p>
              Source batch: <strong>{snapshot.sourceFilename}</strong>
            </p>

            {snapshot.isTooLarge ? (
              <p>
                <strong>Publish blocked:</strong> payload size is too large for
                the current single-metafield strategy. Use a future chunked
                metafield or metaobject strategy for large datasets.
              </p>
            ) : (
              <Form method="post">
                <input type="hidden" name="intent" value="publish" />
                <button type="submit">Publish current approved config</button>
              </Form>
            )}
          </div>
        )}
      </s-section>

      <s-section heading="Publish history">
        {history.length === 0 ? (
          <s-paragraph>No publish history exists yet.</s-paragraph>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {history.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid #d8ddd2",
                  borderRadius: "8px",
                  display: "grid",
                  gap: "0.5rem",
                  padding: "0.75rem",
                }}
              >
                <strong>
                  {entry.status} - {entry.sourceFilename || "stored snapshot"}
                </strong>
                <span>
                  {entry.recordCount} records,{" "}
                  {formatBytes(entry.payloadSizeBytes)} bytes, schema v
                  {entry.schemaVersion}
                </span>
                {entry.message && <span>{entry.message}</span>}
                {(entry.status === "published" ||
                  entry.status === "republished") && (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Form method="post">
                      <input type="hidden" name="intent" value="republish" />
                      <input type="hidden" name="snapshotId" value={entry.id} />
                      <button type="submit">Republish this snapshot</button>
                    </Form>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="deleteSnapshot"
                      />
                      <input type="hidden" name="snapshotId" value={entry.id} />
                      <button type="submit">Delete history</button>
                    </Form>
                  </div>
                )}
                {entry.status !== "published" &&
                  entry.status !== "republished" && (
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="deleteSnapshot"
                      />
                      <input type="hidden" name="snapshotId" value={entry.id} />
                      <button type="submit">Delete history</button>
                    </Form>
                  )}
              </div>
            ))}
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
      <strong style={{ display: "block", fontSize: "1.2rem" }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
