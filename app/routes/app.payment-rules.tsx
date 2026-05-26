import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getActivePincodeRuleOptions } from "../services/pincode-storage.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";
import { parseJsonList } from "../components/rule-manager-ui";

type Option = { id: string; name: string };
type PincodeOption = { id: string; pincode: string; areaGroup: string; deliveryAvailability: string; district: string; locationName: string; state: string };
type PaymentHideRule = { id: string; name: string; enabled: boolean; priority: number; paymentMethodMappingId: string; cutoffRuleSettingId: string; selectedShippingContains: string; productTagsJson: string; pincodesJson: string; areaGroupsJson: string; deliveryAvailabilityText: string; notes: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const [ruleData, pincodeOptions] = await Promise.all([getRuleManagerData(), getActivePincodeRuleOptions()]);
  return { rules: ruleData.paymentHideRules, mappings: ruleData.paymentMethodMappings, cutoffs: ruleData.cutoffRuleSettings, pincodeOptions };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/payment-rules");
};

export default function PaymentRulesPage() {
  const { cutoffs, mappings, pincodeOptions, rules } = useLoaderData<typeof loader>();

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <a className="bsure-back" href="/app">←</a>
            <h1>Update payment hide checkout rule</h1>
          </div>
          <a className="bsure-more" href="/app/payment-mappings">Manage mappings</a>
        </div>

        <div className="bsure-flow">
          <section className="bsure-card">
            <Field label="Name">
              <input className="bsure-input" readOnly value="All Payment Method Hide" />
              <span className="bsure-help">Admin label. Not shown to customers.</span>
            </Field>
          </section>

          <section className="bsure-card">
            <h2>Status</h2>
            <div className="bsure-radio-stack">
              <div className="bsure-radio">
                <input aria-label="Testing" name="status-p" type="radio" />
                <span><span className="bsure-pill testing">Testing</span><br /><span className="bsure-help">Configure rules without affecting checkout.</span></span>
              </div>
              <div className="bsure-radio">
                <input aria-label="Active" defaultChecked name="status-p" type="radio" />
                <span><span className="bsure-pill active">Active</span><br /><span className="bsure-help">Enabled rules will be included in next published config.</span></span>
              </div>
              <div className="bsure-radio">
                <input aria-label="Deactivated" name="status-p" type="radio" />
                <span><span className="bsure-pill disabled">Deactivated</span><br /><span className="bsure-help">Keep rules local without publishing them.</span></span>
              </div>
            </div>
          </section>

          <div className="bsure-connector">And</div>

          <RuleEditor cutoffs={cutoffs} mappings={mappings} pincodeOptions={pincodeOptions.pincodes} areaGroups={pincodeOptions.areaGroups} deliveryAvailabilityValues={pincodeOptions.deliveryAvailabilityValues} />

          <section className="bsure-actions-card">
            <div className="bsure-actions">
              <a className="bsure-button secondary" href="/app/payment-mappings">Manage payment mappings</a>
              <a className="bsure-button secondary" href="/app/pincodes">View imported pincodes</a>
              <a className="bsure-button" href="/app/publish">Publish config</a>
            </div>
          </section>

          <section className="bsure-card">
            <h2>Configured payment hide rules</h2>
            <RuleList items={rules} mappings={mappings} />
          </section>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({ areaGroups, cutoffs, deliveryAvailabilityValues, mappings, pincodeOptions }: { areaGroups: string[]; cutoffs: Option[]; deliveryAvailabilityValues: string[]; mappings: Option[]; pincodeOptions: PincodeOption[] }) {
  return (
    <section className="bsure-card">
      <h2>When...</h2>
      <p>Select conditions that will trigger hiding the payment method.</p>
      <Form method="post">
        <input name="intent" type="hidden" value="paymentHide:create" />
        <div className="bsure-form-row">
          <Field label="Rule name">
            <input className="bsure-input" name="name" placeholder="Payment hide rule label" />
          </Field>
          <Field label="Priority">
            <input className="bsure-input" defaultValue="100" name="priority" />
            <span className="bsure-help">Lower numbers run first.</span>
          </Field>
        </div>
        <div className="bsure-radio" style={{ marginTop: "16px" }}>
          <input aria-label="Enable rule" defaultChecked name="enabled" type="checkbox" />
          <span><strong>Enabled</strong><br /><span className="bsure-help">Include in next published config snapshot.</span></span>
        </div>

        <div className="bsure-condition">
          <ConditionRow label="Zip code / Postal code" operator="Has any of these values" />
          <PincodeChips options={pincodeOptions} />
        </div>

        <div className="bsure-connector">And</div>

        <div className="bsure-condition">
          <ConditionRow label="Payment method" operator="Matches configured mapping" />
          <div className="bsure-form-row">
            <Field label="Payment method mapping">
              <select className="bsure-select" name="paymentMethodMappingId">
                {mappings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Cutoff setting">
              <select className="bsure-select" name="cutoffRuleSettingId">
                <option value="">No cutoff condition</option>
                {cutoffs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="bsure-connector">And</div>

        <div className="bsure-condition">
          <ConditionRow label="Selected shipping method" operator="Contains text" />
          <Field label="Shipping method contains (admin-entered text)">
            <input className="bsure-input" name="selectedShippingContains" placeholder="SHIPPING_METHOD_TEXT_PLACEHOLDER" />
            <span className="bsure-help">Leave blank to match any shipping method.</span>
          </Field>
        </div>

        <div className="bsure-connector">And</div>

        <div className="bsure-condition">
          <ConditionRow label="Area / delivery data" operator="Has any of these values" />
          <div className="bsure-form-row">
            <Field label="Area groups">
              <select className="bsure-select" name="areaGroups">
                <option value="">Any area group</option>
                {areaGroups.map((ag) => <option key={ag} value={ag}>{ag}</option>)}
              </select>
            </Field>
            <Field label="Delivery availability text">
              <select className="bsure-select" name="deliveryAvailabilityText">
                <option value="">Any delivery text</option>
                {deliveryAvailabilityValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="bsure-condition">
          <ConditionRow label="Product condition (future)" operator="Optional" />
          <Field label="Product tags">
            <input className="bsure-input" name="productTags" placeholder="PRODUCT_TAG_PLACEHOLDER" />
            <span className="bsure-help">No live effect until payment Function is activated.</span>
          </Field>
          <Field label="Notes" style={{ marginTop: "14px" }}>
            <textarea className="bsure-textarea" name="notes" placeholder="Internal note" />
          </Field>
        </div>

        <div className="bsure-actions" style={{ marginTop: "18px" }}>
          <button className="bsure-button" type="submit">Save payment hide rule</button>
        </div>
      </Form>
    </section>
  );
}

function ConditionRow({ label, operator }: { label: string; operator: string }) {
  return (
    <div className="bsure-condition-grid">
      <select className="bsure-select" disabled><option>{label}</option></select>
      <select className="bsure-select" disabled><option>{operator}</option></select>
      <button className="bsure-button secondary" disabled type="button">⌫</button>
    </div>
  );
}

function PincodeChips({ options }: { options: PincodeOption[] }) {
  const top = options.slice(0, 400);
  return (
    <div>
      <div className="bsure-chip-box">
        <div className="bsure-chip-list">
          {top.length ? top.map((o) => (
            <label className="bsure-chip" key={o.id} title={`${o.locationName} ${o.district} ${o.areaGroup}`}>
              <input name="pincodes" type="checkbox" value={o.pincode} />
              <span>{o.pincode}</span>
            </label>
          )) : <span className="bsure-help">Approve a CSV import first.</span>}
        </div>
      </div>
      <div className="bsure-chip-meta">
        <span>Bulk-select uploaded CSV pincodes.</span>
        <span>Total: {options.length}</span>
      </div>
    </div>
  );
}

function RuleList({ items, mappings }: { items: PaymentHideRule[]; mappings: Option[] }) {
  if (!items.length) return <p className="bsure-help" style={{ marginTop: "12px" }}>No payment hide rules created yet.</p>;
  return (
    <div className="bsure-rule-list" style={{ marginTop: "12px" }}>
      {items.map((item) => (
        <article className="bsure-rule-item" key={item.id}>
          <div className="bsure-rule-item-top">
            <div>
              <h3>{item.name}</h3>
              <span className={item.enabled ? "bsure-pill active" : "bsure-pill disabled"}>{item.enabled ? "Active" : "Deactivated"}</span>
              <div className="bsure-rule-meta" style={{ marginTop: "6px" }}>
                Priority {item.priority} &nbsp;·&nbsp; Mapping: {mappingName(mappings, item.paymentMethodMappingId)}
                {item.selectedShippingContains && <> &nbsp;·&nbsp; Shipping: {item.selectedShippingContains}</>}
              </div>
              {item.notes && <div className="bsure-rule-meta">{item.notes}</div>}
              <ChipRow items={parseJsonList(item.pincodesJson)} label="Pincodes" />
            </div>
            <Form className="bsure-actions" method="post">
              <input name="id" type="hidden" value={item.id} />
              <button className="bsure-button secondary" name="intent" type="submit" value="paymentHide:toggle">Toggle</button>
              <button className="bsure-button danger" name="intent" type="submit" value="paymentHide:delete">Delete</button>
            </Form>
          </div>
        </article>
      ))}
    </div>
  );
}

function ChipRow({ items, label }: { items: string[]; label: string }) {
  if (!items.length) return null;
  return (
    <div className="bsure-chip-list" style={{ marginTop: "8px" }}>
      <span className="bsure-help">{label}:</span>
      {items.slice(0, 8).map((item) => <span className="bsure-chip" key={item}>{item}</span>)}
      {items.length > 8 && <span className="bsure-help">+{items.length - 8} more</span>}
    </div>
  );
}

function Field({ children, label, style }: { children: React.ReactNode; label: string; style?: React.CSSProperties }) {
  return (
    <div className="bsure-field" style={style}>
      <span className="bsure-label">{label}</span>
      {children}
    </div>
  );
}

function mappingName(mappings: Option[], id: string) {
  return mappings.find((m) => m.id === id)?.name || "Unmapped";
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
