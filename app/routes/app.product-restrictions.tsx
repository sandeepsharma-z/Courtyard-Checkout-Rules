import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getActivePincodeRuleOptions } from "../services/pincode-storage.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";
import { parseJsonList } from "../components/rule-manager-ui";

type PincodeOption = { id: string; pincode: string; areaGroup: string; deliveryAvailability: string; district: string; locationName: string; state: string };
type ProductRestrictionRule = { id: string; name: string; enabled: boolean; priority: number; productTagsJson: string; pincodesJson: string; areaGroupsJson: string; deliveryAvailabilityText: string; validationMessage: string; notes: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const [{ productRestrictionRules }, pincodeOptions] = await Promise.all([getRuleManagerData(), getActivePincodeRuleOptions()]);
  return { rules: productRestrictionRules, pincodeOptions };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/product-restrictions");
};

export default function ProductRestrictionsPage() {
  const { pincodeOptions, rules } = useLoaderData<typeof loader>();

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <a className="bsure-back" href="/app">←</a>
            <h1>Update validates/block checkout rule</h1>
          </div>
          <a className="bsure-more" href="/app/publish">Publish config</a>
        </div>

        <div className="bsure-flow">
          <section className="bsure-card">
            <Field label="Name">
              <input className="bsure-input" readOnly value="All Product Validation" />
              <span className="bsure-help">Admin label. Not shown to customers.</span>
            </Field>
          </section>

          <section className="bsure-card">
            <h2>Behavior</h2>
            <div className="bsure-radio-stack">
              <div className="bsure-radio">
                <input aria-label="Block checkout and show error" defaultChecked name="behavior" type="radio" />
                <span><strong>Block checkout and show error message</strong><br /><span className="bsure-help">Stop the customer from completing checkout if this rule is active.</span></span>
              </div>
              <div className="bsure-radio">
                <input aria-label="Show warning" name="behavior" type="radio" />
                <span><strong>Show warning without blocking checkout</strong><br /><span className="bsure-help">Warn the customer but allow them to continue.</span></span>
              </div>
              <div className="bsure-radio">
                <input aria-label="Block only when customer tries to complete" name="behavior" type="radio" />
                <span><strong>Block only when customer tries to complete order</strong><br /><span className="bsure-help">Allow the customer to continue through checkout, then block when completion is triggered.</span></span>
              </div>
            </div>
          </section>

          <div className="bsure-connector">And</div>

          <RuleEditor areaGroups={pincodeOptions.areaGroups} deliveryAvailabilityValues={pincodeOptions.deliveryAvailabilityValues} pincodeOptions={pincodeOptions.pincodes} />

          <section className="bsure-actions-card">
            <div className="bsure-actions">
              <a className="bsure-button secondary" href="/app/pincodes">View imported pincodes</a>
              <a className="bsure-button" href="/app/publish">Publish config</a>
            </div>
          </section>

          <section className="bsure-card">
            <h2>Configured validation rules</h2>
            <RuleList items={rules} />
          </section>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({ areaGroups, deliveryAvailabilityValues, pincodeOptions }: { areaGroups: string[]; deliveryAvailabilityValues: string[]; pincodeOptions: PincodeOption[] }) {
  return (
    <section className="bsure-card">
      <h2>When...</h2>
      <p>Select conditions that trigger the validation block or warning.</p>
      <Form method="post">
        <input name="intent" type="hidden" value="productRestriction:create" />
        <div className="bsure-form-row">
          <Field label="Rule name">
            <input className="bsure-input" name="name" placeholder="Validation rule label" />
          </Field>
          <Field label="Priority">
            <input className="bsure-input" defaultValue="100" name="priority" />
            <span className="bsure-help">Lower numbers evaluate first.</span>
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
          <ConditionRow label="Product tags" operator="Has any of these values" />
          <Field label="Product tags (comma-separated, admin-configured)">
            <input className="bsure-input" name="productTags" placeholder="PRODUCT_TAG_PLACEHOLDER" />
            <span className="bsure-help">Tags must come from admin configuration, not hardcoded.</span>
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

        <div className="bsure-connector">Then block checkout and show an error message like this...</div>

        <div className="bsure-condition">
          <div className="bsure-form-row">
            <Field label="Target">
              <input className="bsure-input" defaultValue="Shipping zip code" readOnly />
              <span className="bsure-help">Where the error message will be displayed at checkout.</span>
            </Field>
          </div>
          <Field label="Error message" style={{ marginTop: "14px" }}>
            <input className="bsure-input" name="validationMessage" placeholder="Product not available at your location (Connect with Customer Support)" />
            <span className="bsure-help">Shown to customer at checkout when conditions match.</span>
          </Field>
        </div>

        <Field label="Notes" style={{ marginTop: "14px" }}>
          <textarea className="bsure-textarea" name="notes" placeholder="Internal note" />
        </Field>

        <div className="bsure-actions" style={{ marginTop: "18px" }}>
          <button className="bsure-button" type="submit">Save validation rule</button>
          <button className="bsure-button secondary" type="reset">Cancel</button>
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

function RuleList({ items }: { items: ProductRestrictionRule[] }) {
  if (!items.length) return <p className="bsure-help" style={{ marginTop: "12px" }}>No validation rules created yet.</p>;
  return (
    <div className="bsure-rule-list" style={{ marginTop: "12px" }}>
      {items.map((item) => (
        <article className="bsure-rule-item" key={item.id}>
          <div className="bsure-rule-item-top">
            <div>
              <h3>{item.name}</h3>
              <span className={item.enabled ? "bsure-pill active" : "bsure-pill disabled"}>{item.enabled ? "Active" : "Deactivated"}</span>
              <div className="bsure-rule-meta" style={{ marginTop: "6px" }}>Priority {item.priority}</div>
              {item.validationMessage && <div className="bsure-rule-meta">Message: {item.validationMessage}</div>}
              {item.notes && <div className="bsure-rule-meta">{item.notes}</div>}
              <ChipRow items={parseJsonList(item.pincodesJson)} label="Pincodes" />
              <ChipRow items={parseJsonList(item.productTagsJson)} label="Tags" />
            </div>
            <Form className="bsure-actions" method="post">
              <input name="id" type="hidden" value={item.id} />
              <button className="bsure-button secondary" name="intent" type="submit" value="productRestriction:toggle">Toggle</button>
              <button className="bsure-button danger" name="intent" type="submit" value="productRestriction:delete">Delete</button>
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

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
