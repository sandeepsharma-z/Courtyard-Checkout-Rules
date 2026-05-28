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

        <div className="bsure-flow">
          <section className="bsure-card">
            <h2>Checkout behavior settings</h2>
            <p>
              These settings are published into Shopify config. Checkout only
              changes after you save settings and publish config.
            </p>
            <Form method="post" className="bsure-form-grid">
              <input name="intent" type="hidden" value="settings:save" />
              <label className="bsure-check">
                <input
                  defaultChecked={settings.blockUnknownPincode}
                  name="blockUnknownPincode"
                  type="checkbox"
                />
                Block pincodes that are not in the active pincode list
              </label>
              <Field label="Unknown pincode error message">
                <input
                  className="bsure-input"
                  defaultValue={settings.unknownPincodeMessage}
                  name="unknownPincodeMessage"
                  placeholder="Message shown under PIN code when delivery is unavailable"
                />
              </Field>
              <label className="bsure-check">
                <input
                  defaultChecked={settings.autoRenameDeliveryOption}
                  name="autoRenameDeliveryOption"
                  type="checkbox"
                />
                Show pincode delivery text as the shipping method label
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
              <label className="bsure-check">
                <input
                  defaultChecked={settings.hideOtherDeliveryOptions}
                  name="hideOtherDeliveryOptions"
                  type="checkbox"
                />
                When delivery text matches, hide other Shopify shipping options
              </label>
              <button className="bsure-button" type="submit">
                Save checkout settings
              </button>
            </Form>
          </section>

          <section className="bsure-card">
            <h2>Add or update manual pincode</h2>
            <p>
              Enter one pincode or paste bulk rows. All values are stored as
              text and can be changed from admin.
            </p>
            <Form method="post" className="bsure-form-grid">
              <input name="intent" type="hidden" value="manual:add" />
              <div className="bsure-grid-two">
                <Field label="Pincode">
                  <input className="bsure-input" name="pincode" />
                </Field>
                <Field label="Area group">
                  <input className="bsure-input" name="areaGroup" />
                </Field>
              </div>
              <div className="bsure-grid-two">
                <Field label="State">
                  <input className="bsure-input" name="state" />
                </Field>
                <Field label="District">
                  <input className="bsure-input" name="district" />
                </Field>
              </div>
              <Field label="Location / area name">
                <input className="bsure-input" name="locationName" />
              </Field>
              <Field label="Delivery availability text">
                <input className="bsure-input" name="deliveryAvailability" />
              </Field>
              <Field label="Same day delivery">
                <textarea
                  className="bsure-textarea"
                  name="sameDayDeliveryRule"
                  placeholder="Example structure only: same day delivery text from admin"
                  rows={3}
                />
              </Field>
              <Field label="Next day delivery">
                <textarea
                  className="bsure-textarea"
                  name="nextDayDeliveryRule"
                  placeholder="Example structure only: next day delivery text from admin"
                  rows={2}
                />
              </Field>
              <Field label="Product availability / block note">
                <input className="bsure-input" name="productAvailabilityRule" />
              </Field>
              <Field label="Charges / pricing text">
                <input className="bsure-input" name="chargesPricingText" />
              </Field>
              <Field label="Bulk rows">
                <textarea
                  className="bsure-textarea"
                  name="bulkRows"
                  placeholder="One row per line: PINCODE | SAME_DAY_TEXT | NEXT_DAY_TEXT | AREA_GROUP | DELIVERY_TEXT"
                  rows={6}
                />
              </Field>
              <button className="bsure-button" type="submit">
                Save manual pincode rules
              </button>
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
      const [pincode, sameDayDeliveryRule, nextDayDeliveryRule, areaGroup, deliveryAvailability] =
        line.split("|").map((part) => part.trim());
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
