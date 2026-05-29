import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  clearActivePincodeRecords,
  deleteActivePincodeRecord,
  getActivePincodeSummary,
  upsertManualPincodeRecords,
} from "../services/pincode-storage.server";
import {
  getCheckoutRuleSettings,
  saveCheckoutRuleSettings,
  type CheckoutRuleSettings,
} from "../services/checkout-settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const [summary, settings] = await Promise.all([
    getActivePincodeSummary(),
    getCheckoutRuleSettings(),
  ]);

  return { settings, ...summary };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "manual:add") {
      await upsertManualPincodeRecords({
        records: parseManualRows(String(formData.get("bulkRows") ?? ""), {
          pincode: String(formData.get("pincode") ?? ""),
          state: String(formData.get("state") ?? ""),
          district: String(formData.get("district") ?? ""),
          locationName: String(formData.get("locationName") ?? ""),
          areaGroup: String(formData.get("areaGroup") ?? ""),
          deliveryAvailability: String(
            formData.get("deliveryAvailability") ?? "",
          ),
          sameDayDeliveryRule: String(formData.get("sameDayDeliveryRule") ?? ""),
          nextDayDeliveryRule: String(formData.get("nextDayDeliveryRule") ?? ""),
          productAvailabilityRule: String(
            formData.get("productAvailabilityRule") ?? "",
          ),
          remarks: String(formData.get("remarks") ?? ""),
          chargesPricingText: String(formData.get("chargesPricingText") ?? ""),
          updatedSameDayRule: String(formData.get("updatedSameDayRule") ?? ""),
          updatedNextDayRule: String(formData.get("updatedNextDayRule") ?? ""),
        }),
      });
      return redirect("/app/pincodes?status=manual-saved");
    }

    if (intent === "settings:save") {
      const settings: CheckoutRuleSettings = {
        blockUnknownPincode: formData.get("blockUnknownPincode") === "on",
        unknownPincodeMessage: String(
          formData.get("unknownPincodeMessage") ?? "",
        ).trim(),
        autoRenameDeliveryOption:
          formData.get("autoRenameDeliveryOption") === "on",
        deliveryLabelSource: parseDeliveryLabelSource(
          String(formData.get("deliveryLabelSource") ?? ""),
        ),
        hideOtherDeliveryOptions:
          formData.get("hideOtherDeliveryOptions") === "on",
        blockMatchingDeliveryText:
          formData.get("blockMatchingDeliveryText") === "on",
        deliveryBlockMatchText: String(
          formData.get("deliveryBlockMatchText") ?? "",
        ).trim(),
        deliveryBlockMessage: String(
          formData.get("deliveryBlockMessage") ?? "",
        ).trim(),
      };
      await saveCheckoutRuleSettings(settings);
      return redirect("/app/pincodes?status=settings-saved");
    }

    if (intent === "record:delete") {
      await deleteActivePincodeRecord(String(formData.get("id") ?? ""));
      return redirect("/app/pincodes?status=record-deleted");
    }

    if (intent === "records:clear") {
      await clearActivePincodeRecords();
      return redirect("/app/pincodes?status=records-cleared");
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save changes.",
    };
  }

  return null;
};

export default function PincodeGroupsPage() {
  const { activeCount, approvedBatch, recentRecords, settings } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <Link className="bsure-back" to="/app">
              ←
            </Link>
            <h1>Manual pincode delivery rules</h1>
          </div>
          <Link className="bsure-more" to="/app/publish">
            Publish config
          </Link>
        </div>

        {actionData && "error" in actionData && actionData.error ? (
          <section className="bsure-card">
            <p style={{ color: "#d72c0d", margin: 0 }}>{actionData.error}</p>
          </section>
        ) : null}

        <div className="bsure-flow pincode-flow">
          <section className="bsure-card pincode-settings-card">
            <div className="pincode-section-head">
              <div>
                <h2>Checkout behavior</h2>
                <p>Save here, then publish config to update checkout.</p>
              </div>
              <button className="bsure-button" form="checkout-settings-form" type="submit">
                Save settings
              </button>
            </div>
            <Form
              id="checkout-settings-form"
              method="post"
              className="pincode-settings-grid"
            >
              <input name="intent" type="hidden" value="settings:save" />
              <label className="pincode-switch">
                <input
                  defaultChecked={settings.blockUnknownPincode}
                  name="blockUnknownPincode"
                  type="checkbox"
                />
                <span>Block unknown pincode</span>
              </label>
              <Field label="Unknown pincode message">
                <input
                  className="bsure-input"
                  defaultValue={settings.unknownPincodeMessage}
                  name="unknownPincodeMessage"
                  placeholder="Message shown under PIN code"
                />
              </Field>
              <label className="pincode-switch">
                <input
                  defaultChecked={settings.autoRenameDeliveryOption}
                  name="autoRenameDeliveryOption"
                  type="checkbox"
                />
                <span>Show delivery text as shipping label</span>
              </label>
              <Field label="Delivery label source">
                <select
                  className="bsure-select"
                  defaultValue={settings.deliveryLabelSource}
                  name="deliveryLabelSource"
                >
                  <option value="updated_first">Updated text first</option>
                  <option value="same_day">Same day delivery text</option>
                  <option value="next_day">Next day delivery text</option>
                </select>
              </Field>
              <label className="pincode-switch">
                <input
                  defaultChecked={settings.hideOtherDeliveryOptions}
                  name="hideOtherDeliveryOptions"
                  type="checkbox"
                />
                <span>Hide other Shopify shipping options</span>
              </label>
              <label className="pincode-switch">
                <input
                  defaultChecked={settings.blockMatchingDeliveryText}
                  name="blockMatchingDeliveryText"
                  type="checkbox"
                />
                <span>Block when delivery text matches</span>
              </label>
              <Field label="Blocked delivery text">
                <input
                  className="bsure-input"
                  defaultValue={settings.deliveryBlockMatchText}
                  name="deliveryBlockMatchText"
                  placeholder="Text from delivery fields that means blocked"
                />
              </Field>
              <Field label="Blocked pincode message">
                <input
                  className="bsure-input"
                  defaultValue={settings.deliveryBlockMessage}
                  name="deliveryBlockMessage"
                  placeholder="Message shown under PIN code"
                />
              </Field>
            </Form>
          </section>

          <section className="bsure-card pincode-entry-card">
            <div className="pincode-section-head">
              <div>
                <h2>Add pincode delivery detail</h2>
                <p>Fill it like one row from the PDF or sheet.</p>
              </div>
              <button className="bsure-button" form="manual-pincode-form" type="submit">
                Save pincode
              </button>
            </div>
            <Form
              id="manual-pincode-form"
              method="post"
              className="pincode-entry-grid"
            >
              <input name="intent" type="hidden" value="manual:add" />
              <Field label="Pincode">
                <input className="bsure-input" name="pincode" />
              </Field>
              <Field label="State">
                <input className="bsure-input" name="state" />
              </Field>
              <Field label="District">
                <input className="bsure-input" name="district" />
              </Field>
              <Field label="Area group">
                <input className="bsure-input" name="areaGroup" />
              </Field>
              <Field label="Sales / delivery availability">
                <input className="bsure-input" name="deliveryAvailability" />
              </Field>
              <Field label="Remarks">
                <input className="bsure-input" name="remarks" />
              </Field>
              <Field label="Location / understanding area">
                <textarea
                  className="bsure-textarea"
                  name="locationName"
                  rows={3}
                />
              </Field>
              <Field label="Same day delivery text">
                <textarea
                  className="bsure-textarea"
                  name="sameDayDeliveryRule"
                  rows={3}
                />
              </Field>
              <Field label="Next day delivery text">
                <textarea
                  className="bsure-textarea"
                  name="nextDayDeliveryRule"
                  rows={3}
                />
              </Field>
              <Field label="Updated same day text">
                <textarea
                  className="bsure-textarea"
                  name="updatedSameDayRule"
                  rows={2}
                />
              </Field>
              <Field label="Updated next day text">
                <textarea
                  className="bsure-textarea"
                  name="updatedNextDayRule"
                  rows={2}
                />
              </Field>
              <Field label="Product availability / block text">
                <input className="bsure-input" name="productAvailabilityRule" />
              </Field>
              <Field label="Charges / pricing text">
                <input className="bsure-input" name="chargesPricingText" />
              </Field>
              <Field label="Bulk paste rows">
                <textarea
                  className="bsure-textarea"
                  name="bulkRows"
                  placeholder="One row per line: STATE | DISTRICT | PINCODE | AREA_GROUP | SALES_OR_AVAILABILITY | LOCATION_TEXT | REMARKS | SAME_DAY_TEXT | NEXT_DAY_TEXT"
                  rows={6}
                />
              </Field>
            </Form>
          </section>

          <section className="bsure-card">
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <h2>Active pincode records</h2>
                <p>
                  {activeCount} active records
                  {approvedBatch ? ` · Source: ${approvedBatch.filename}` : ""}
                </p>
              </div>
              <Form method="post">
                <input name="intent" type="hidden" value="records:clear" />
                <button className="bsure-button danger" type="submit">
                  Clear active records
                </button>
              </Form>
            </div>
            <div className="bsure-table-wrap">
              <table className="rules-table">
                <thead>
                  <tr>
                    {[
                      "Pincode",
                      "Area group",
                      "Same day",
                      "Next day",
                      "Delivery text",
                      "Action",
                    ].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.pincode}</td>
                      <td>{record.areaGroup}</td>
                      <td>{record.sameDayDeliveryRule}</td>
                      <td>{record.nextDayDeliveryRule}</td>
                      <td>{record.deliveryAvailability}</td>
                      <td>
                        <Form method="post">
                          <input name="intent" type="hidden" value="record:delete" />
                          <input name="id" type="hidden" value={record.id} />
                          <button className="bsure-link-button" type="submit">
                            Delete
                          </button>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="bsure-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function parseManualRows(
  bulkRows: string,
  single: {
    pincode: string;
    state: string;
    district: string;
    locationName: string;
    areaGroup: string;
    deliveryAvailability: string;
    sameDayDeliveryRule: string;
    nextDayDeliveryRule: string;
    productAvailabilityRule: string;
    remarks: string;
    chargesPricingText: string;
    updatedSameDayRule: string;
    updatedNextDayRule: string;
  },
) {
  const rows = bulkRows
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts =
        line.split("|").map((part) => part.trim());

      if (parts.length >= 9) {
        const [
          state,
          district,
          pincode,
          areaGroup,
          deliveryAvailability,
          locationName,
          remarks,
          sameDayDeliveryRule,
          nextDayDeliveryRule,
        ] = parts;

        return {
          areaGroup,
          deliveryAvailability,
          district,
          locationName,
          nextDayDeliveryRule,
          pincode,
          remarks,
          sameDayDeliveryRule,
          state,
        };
      }

      const [
        pincode,
        sameDayDeliveryRule,
        nextDayDeliveryRule,
        areaGroup,
        deliveryAvailability,
      ] = parts;

      return {
        pincode,
        areaGroup,
        deliveryAvailability,
        sameDayDeliveryRule,
        nextDayDeliveryRule,
      };
    });

  if (rows.length > 0) return rows;
  return [single];
}

function parseDeliveryLabelSource(
  value: string,
): CheckoutRuleSettings["deliveryLabelSource"] {
  if (value === "same_day" || value === "next_day" || value === "updated_first") {
    return value;
  }
  return "updated_first";
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
