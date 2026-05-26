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

        <div className="bsure-rule-shell">
          {/* ── Name ── */}
          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <F label="Name">
              <div className="bsure-name-row">
                <input className="bsure-input bsure-name-input" defaultValue="All Product Validation" maxLength={70} name="ruleName" readOnly />
                <span className="bsure-char-count">22/70</span>
              </div>
              <span className="bsure-help">Optional. Not shown to customers.</span>
            </F>
          </section>

          {/* ── Status ── */}
          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <h2>Status</h2>
            <div className="bsure-radio-stack" style={{ marginTop: "10px" }}>
              <Sradio label="Testing" pill="testing" sub="Test this rule without affecting checkout for your customers. Write test@testing.com in the email field on the checkout to see this rule in action." />
              <Sradio defaultChecked label="Active" pill="active" sub="Rule will be enabled on your store, this will affect checkout for all customers." />
              <Sradio label="Deactivated" pill="disabled" sub="Disable this rule without deleting it. Deactivated rules will not affect checkout for your customers." />
            </div>
          </section>

          {/* ── Behavior ── */}
          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <h2>Behavior</h2>
            <div className="bsure-radio-stack" style={{ marginTop: "10px" }}>
              <div className="bsure-radio">
                <input defaultChecked name="behavior" type="radio" value="block" />
                <span><strong>Block checkout and show error message</strong><br /><span className="bsure-help">Stop the customer from completing checkout if this rule is active.</span></span>
              </div>
              <div className="bsure-radio">
                <input name="behavior" type="radio" value="warn" />
                <span><strong>Show warning without blocking checkout</strong><br /><span className="bsure-help">Warn the customer but allow them to continue.</span></span>
              </div>
              <div className="bsure-radio">
                <input name="behavior" type="radio" value="block-on-complete" />
                <span><strong>Block only when customer tries to complete order</strong><br /><span className="bsure-help">Allow the customer to continue through checkout, then block when completion is triggered.</span></span>
              </div>
            </div>
          </section>

          <div className="bsure-connector">And</div>

          {/* ── RULE FORM ── */}
          <WhenThenBlock areaGroups={pincodeOptions.areaGroups} deliveryAvailabilityValues={pincodeOptions.deliveryAvailabilityValues} pincodeOptions={pincodeOptions.pincodes} />

          {/* ── If app fails ── */}
          <div className="bsure-lastly" style={{ marginTop: "12px" }}>
            <p>If the app fails to determine the time/date or customer location...</p>
            <div className="bsure-if-radio"><input defaultChecked name="fallback" type="radio" value="nothing" /><span>Do nothing</span></div>
            <div className="bsure-if-radio"><input name="fallback" type="radio" value="action" /><span>Do this action</span></div>
          </div>

          {/* ── Actions ── */}
          <div className="bsure-bottom-bar">
            <a className="bsure-button secondary" href="/app/pincodes">View imported pincodes</a>
            <a className="bsure-button" href="/app/publish">Publish config</a>
          </div>

          {/* ── Existing rules ── */}
          {rules.length > 0 && (
            <section className="bsure-card" style={{ marginTop: "24px" }}>
              <div className="bsure-section-top">
                <h2>Configured validation rules</h2>
                <span className="bsure-help">{rules.length} rule{rules.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="bsure-rule-list">
                {rules.map((item) => <RuleItem item={item} key={item.id} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function WhenThenBlock({ areaGroups, deliveryAvailabilityValues, pincodeOptions }: { areaGroups: string[]; deliveryAvailabilityValues: string[]; pincodeOptions: PincodeOption[] }) {
  return (
    <Form method="post">
      <input name="intent" type="hidden" value="productRestriction:create" />

      {/* When card */}
      <div className="bsure-when-card">
        <div className="bsure-when-header">
          <div>
            <div className="bsure-when-title">When...</div>
            <div className="bsure-when-sub">Select the conditions here which will trigger the execution</div>
          </div>
          <button className="bsure-when-close" title="Close" type="button">×</button>
        </div>

        {/* Zip code condition */}
        <div className="bsure-cond-row">
          <select className="bsure-select" disabled><option>Zip code / Postal code</option></select>
          <select className="bsure-select" disabled><option>Has any of these values</option></select>
          <button className="bsure-cond-del" disabled type="button">🗑</button>
        </div>
        <PincodeChips options={pincodeOptions} />

        <div className="bsure-mini-or">And</div>

        {/* Product tags condition */}
        <div className="bsure-cond-row">
          <select className="bsure-select" disabled><option>Product tags</option></select>
          <select className="bsure-select" disabled><option>Has any of these values</option></select>
          <button className="bsure-cond-del" disabled type="button">🗑</button>
        </div>
        <div style={{ marginBottom: "8px" }}>
          <input className="bsure-input" name="productTags" placeholder="Comma-separated product tags (admin-configured)" style={{ width: "100%" }} />
          <span className="bsure-help">Tags must come from admin configuration, not hardcoded.</span>
        </div>

        <div className="bsure-mini-or">And</div>

        {/* Area / delivery condition */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
          <select className="bsure-select" name="areaGroups">
            <option value="">Any area group</option>
            {areaGroups.map((ag) => <option key={ag} value={ag}>{ag}</option>)}
          </select>
          <select className="bsure-select" name="deliveryAvailabilityText">
            <option value="">Any delivery text</option>
            {deliveryAvailabilityValues.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "8px" }}>
          <button className="bsure-add-link" type="button">+ Add sub-condition</button>
          <span style={{ color: "#d4d4d4" }}>|</span>
          <span className="bsure-mini-or" style={{ margin: 0 }}>Or</span>
          <span style={{ color: "#d4d4d4" }}>|</span>
          <button className="bsure-add-link" type="button">+ Add another condition</button>
        </div>
      </div>

      {/* Then block */}
      <div style={{ marginTop: "12px", padding: "14px", background: "#fff", border: "1px solid #d4d4d4", borderRadius: "8px" }}>
        <div className="bsure-then-label">Then block checkout and show an error message...</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "10px 0 8px" }}>
          <F label="Target">
            <input className="bsure-input" defaultValue="Shipping zip code" readOnly />
            <span className="bsure-help">Where the error message will be displayed at checkout.</span>
          </F>
        </div>

        <F label="Error message">
          <input className="bsure-input" name="validationMessage" placeholder="Product not available at your location (Connect with Customer Support)" style={{ width: "100%" }} />
          <span className="bsure-help">Shown to customer at checkout when conditions match.</span>
        </F>
        <div style={{ marginTop: "6px" }}>
          <a className="bsure-add-link" href="#add-translation">+ Add translation</a>
        </div>
      </div>

      {/* Rule meta */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
        <F label="Rule name"><input className="bsure-input" name="name" placeholder="Validation rule label" /></F>
        <F label="Priority">
          <input className="bsure-input" defaultValue="100" name="priority" type="number" />
          <span className="bsure-help">Lower numbers evaluate first.</span>
        </F>
      </div>
      <div className="bsure-radio" style={{ margin: "10px 0" }}>
        <input defaultChecked name="enabled" type="checkbox" />
        <span><strong>Enabled</strong> — <span className="bsure-help">Include in next published config snapshot</span></span>
      </div>
      <F label="Notes" style={{ marginTop: "8px" }}>
        <textarea className="bsure-textarea" name="notes" placeholder="Internal note" rows={2} />
      </F>
      <div className="bsure-actions" style={{ marginTop: "10px" }}>
        <button className="bsure-button" type="submit">Save validation rule</button>
        <button className="bsure-button secondary" type="reset">Cancel</button>
      </div>
    </Form>
  );
}

function PincodeChips({ options }: { options: PincodeOption[] }) {
  const top = options.slice(0, 400);
  return (
    <div style={{ marginBottom: "8px" }}>
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

function Sradio({ defaultChecked, label, pill, sub }: { defaultChecked?: boolean; label: string; pill: string; sub: string }) {
  return (
    <div className="bsure-radio">
      <input defaultChecked={defaultChecked} name="status" type="radio" value={label.toLowerCase()} />
      <span>
        <span className={`bsure-pill ${pill}`}>{label}</span><br />
        <span className="bsure-help">{sub}</span>
      </span>
    </div>
  );
}

function RuleItem({ item }: { item: ProductRestrictionRule }) {
  return (
    <article className="bsure-rule-item">
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

function F({ children, label, style }: { children: React.ReactNode; label: string; style?: React.CSSProperties }) {
  return (
    <div className="bsure-field" style={style}>
      <span className="bsure-label">{label}</span>
      {children}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
