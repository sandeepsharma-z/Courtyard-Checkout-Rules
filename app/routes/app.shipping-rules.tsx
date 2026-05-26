import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getActivePincodeRuleOptions } from "../services/pincode-storage.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";
import { parseJsonList } from "../components/rule-manager-ui";

type Option = { id: string; name: string };
type PincodeOption = { id: string; pincode: string; areaGroup: string; deliveryAvailability: string; district: string; locationName: string; state: string };
type ShippingRule = { id: string; name: string; enabled: boolean; priority: number; shippingMethodMappingId: string; cutoffRuleSettingId: string; productTagsJson: string; pincodesJson: string; areaGroupsJson: string; deliveryAvailabilityText: string; notes: string };
type ShippingRenameRule = ShippingRule & { newLabel: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const [ruleData, pincodeOptions] = await Promise.all([getRuleManagerData(), getActivePincodeRuleOptions()]);
  return { hideRules: ruleData.shippingHideRules, renameRules: ruleData.shippingRenameRules, mappings: ruleData.shippingMethodMappings, cutoffs: ruleData.cutoffRuleSettings, pincodeOptions };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/shipping-rules");
};

export default function ShippingRulesPage() {
  const { cutoffs, hideRules, mappings, pincodeOptions, renameRules } = useLoaderData<typeof loader>();

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <a className="bsure-back" href="/app">←</a>
            <h1>Update hide shipping methods rule</h1>
          </div>
          <a className="bsure-more" href="/app/publish">Publish config</a>
        </div>

        <div className="bsure-rule-shell">
          {/* ── Name ── */}
          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <F label="Name">
              <div className="bsure-name-row">
                <input className="bsure-input bsure-name-input" defaultValue="All Shipping Method Hide" maxLength={70} name="ruleName" readOnly />
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

          {/* ── Target ── */}
          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <h2>Target</h2>
            <div className="bsure-target-grid">
              <div className="bsure-target-item">
                <input defaultChecked name="target" type="radio" value="ship" />
                <div>
                  <div className="bsure-target-label">🚢 Ship</div>
                  <div className="bsure-target-sub">This rule targets shipping methods (which are shown when you fill in shipping address) at the checkout and modifies them.</div>
                </div>
              </div>
              <div className="bsure-target-item">
                <input name="target" type="radio" value="all-except-sub" />
                <div>
                  <div className="bsure-target-label">All shipments except subscriptions</div>
                </div>
              </div>
              <div className="bsure-target-item">
                <input name="target" type="radio" value="all" />
                <div>
                  <div className="bsure-target-label">All shipments</div>
                </div>
              </div>
              <div className="bsure-target-item">
                <input name="target" type="radio" value="pickup" />
                <div>
                  <div className="bsure-target-label">Pick Up</div>
                  <div className="bsure-target-sub">This rule targets pickup methods (which are shown when you select &apos;Pickup in store&apos; and then a location) at the checkout and modifies them.</div>
                </div>
              </div>
            </div>
          </section>

          <div className="bsure-connector">And</div>

          {/* ── HIDE RULE FORM ── */}
          <WhenThenHide areaGroups={pincodeOptions.areaGroups} cutoffs={cutoffs} deliveryAvailabilityValues={pincodeOptions.deliveryAvailabilityValues} mappings={mappings} pincodeOptions={pincodeOptions.pincodes} />

          <div className="bsure-connector" style={{ margin: "16px auto" }}>Then</div>

          {/* ── RENAME RULE FORM ── */}
          <WhenThenRename areaGroups={pincodeOptions.areaGroups} cutoffs={cutoffs} deliveryAvailabilityValues={pincodeOptions.deliveryAvailabilityValues} mappings={mappings} pincodeOptions={pincodeOptions.pincodes} />

          {/* ── If app fails ── */}
          <div className="bsure-lastly" style={{ marginTop: "12px" }}>
            <p>If the app fails to determine the time/date or customer location...</p>
            <div className="bsure-if-radio"><input defaultChecked name="fallback" type="radio" value="nothing" /><span>Do nothing</span></div>
            <div className="bsure-if-radio"><input name="fallback" type="radio" value="action" /><span>Do this action</span></div>
          </div>

          {/* ── Actions ── */}
          <div className="bsure-bottom-bar">
            <a className="bsure-button secondary" href="/app/shipping-mappings">Manage mappings</a>
            <a className="bsure-button secondary" href="/app/pincodes">View pincodes</a>
            <a className="bsure-button" href="/app/publish">Publish config</a>
          </div>

          {/* ── Existing hide rules ── */}
          {hideRules.length > 0 && (
            <section className="bsure-card" style={{ marginTop: "24px" }}>
              <div className="bsure-section-top">
                <h2>Configured hide rules</h2>
                <span className="bsure-help">{hideRules.length} rule{hideRules.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="bsure-rule-list">
                {hideRules.map((item) => <RuleItem item={item} key={item.id} kind="shippingHide" mappings={mappings} />)}
              </div>
            </section>
          )}

          {/* ── Existing rename rules ── */}
          {renameRules.length > 0 && (
            <section className="bsure-card" style={{ marginTop: "12px" }}>
              <div className="bsure-section-top">
                <h2>Configured rename rules</h2>
                <span className="bsure-help">{renameRules.length} rule{renameRules.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="bsure-rule-list">
                {renameRules.map((item) => <RenameRuleItem item={item} key={item.id} mappings={mappings} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function WhenThenHide({ areaGroups, cutoffs, deliveryAvailabilityValues, mappings, pincodeOptions }: { areaGroups: string[]; cutoffs: Option[]; deliveryAvailabilityValues: string[]; mappings: Option[]; pincodeOptions: PincodeOption[] }) {
  return (
    <Form method="post">
      <input name="intent" type="hidden" value="shippingHide:create" />
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

        {/* Shipping method condition */}
        <div className="bsure-cond-row">
          <select className="bsure-select" name="shippingMethodMappingId">
            <option value="">Shipping method mapping</option>
            {mappings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="bsure-select" disabled><option>Matches configured mapping</option></select>
          <button className="bsure-cond-del" disabled type="button">🗑</button>
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
        <div className="bsure-then-label">Then hide shipping methods using...</div>
        <select className="bsure-select" style={{ marginBottom: "10px", width: "auto" }} name="hideAction" defaultValue="hide">
          <option value="hide">Hide these shipping methods</option>
          <option value="show">Only show these shipping methods</option>
        </select>
        <table className="bsure-method-table">
          <thead>
            <tr><th>No.</th><th>Shipping method</th><th></th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ color: "#6d7175", width: "40px" }}>1</td>
              <td>
                <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px" }}>
                  <select className="bsure-select" disabled><option>Is</option></select>
                  <select className="bsure-select" name="shippingMethodMappingId_then">
                    <option value="">Select method mapping</option>
                    {mappings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </td>
              <td style={{ width: "40px" }}><button className="bsure-cond-del" disabled type="button">🗑</button></td>
            </tr>
            <tr className="bsure-method-add-row">
              <td colSpan={3}>
                <button className="bsure-add-link" type="button">+ Add shipping method</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rule meta */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
        <F label="Rule name"><input className="bsure-input" name="name" placeholder="Hide rule label" /></F>
        <F label="Priority"><input className="bsure-input" defaultValue="100" name="priority" type="number" /></F>
      </div>
      <div className="bsure-radio" style={{ margin: "10px 0" }}>
        <input defaultChecked name="enabled" type="checkbox" />
        <span><strong>Enabled</strong> — <span className="bsure-help">Include in next published config</span></span>
      </div>
      <F label="Cutoff setting">
        <select className="bsure-select" name="cutoffRuleSettingId">
          <option value="">No cutoff condition</option>
          {cutoffs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </F>
      <F label="Notes" style={{ marginTop: "8px" }}>
        <textarea className="bsure-textarea" name="notes" placeholder="Internal note" rows={2} />
      </F>
      <div className="bsure-actions" style={{ marginTop: "10px" }}>
        <button className="bsure-button" type="submit">Save hide rule</button>
      </div>
    </Form>
  );
}

function WhenThenRename({ areaGroups, cutoffs, deliveryAvailabilityValues, mappings, pincodeOptions }: { areaGroups: string[]; cutoffs: Option[]; deliveryAvailabilityValues: string[]; mappings: Option[]; pincodeOptions: PincodeOption[] }) {
  return (
    <div style={{ marginTop: "4px" }}>
      <div style={{ color: "#202223", fontSize: "14px", fontWeight: 700, marginBottom: "10px" }}>Update rename shipping methods rule</div>
      <Form method="post">
        <input name="intent" type="hidden" value="shippingRename:create" />
        <div className="bsure-when-card">
          <div className="bsure-when-header">
            <div>
              <div className="bsure-when-title">When...</div>
              <div className="bsure-when-sub">Select the conditions here which will trigger the execution</div>
            </div>
            <button className="bsure-when-close" title="Close" type="button">×</button>
          </div>

          <div className="bsure-cond-row">
            <select className="bsure-select" disabled><option>Zip code / Postal code</option></select>
            <select className="bsure-select" disabled><option>Has any of these values</option></select>
            <button className="bsure-cond-del" disabled type="button">🗑</button>
          </div>
          <PincodeChips options={pincodeOptions} />

          <div className="bsure-mini-or">And</div>

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

        {/* Then rename block */}
        <div style={{ marginTop: "12px", padding: "14px", background: "#fff", border: "1px solid #d4d4d4", borderRadius: "8px" }}>
          <div className="bsure-then-label">Then rename shipping methods like this...</div>
          <table className="bsure-method-table">
            <thead>
              <tr><th>Shipping method</th><th>New name</th><th></th></tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "6px" }}>
                    <select className="bsure-select" disabled><option>Is</option></select>
                    <select className="bsure-select" name="shippingMethodMappingId">
                      <option value="">Select method mapping</option>
                      {mappings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </td>
                <td>
                  <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "6px" }}>
                    <select className="bsure-select" disabled><option>Rename to</option></select>
                    <input className="bsure-input" name="newLabel" placeholder="New shipping label" />
                  </div>
                </td>
                <td style={{ width: "40px" }}><button className="bsure-cond-del" disabled type="button">🗑</button></td>
              </tr>
              <tr className="bsure-method-add-row">
                <td colSpan={3}><button className="bsure-add-link" type="button">+ Add shipping method</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
          <F label="Rule name"><input className="bsure-input" name="name" placeholder="Rename rule label" /></F>
          <F label="Priority"><input className="bsure-input" defaultValue="100" name="priority" type="number" /></F>
        </div>
        <div className="bsure-radio" style={{ margin: "10px 0" }}>
          <input defaultChecked name="enabled" type="checkbox" />
          <span><strong>Enabled</strong> — <span className="bsure-help">Include in next published config</span></span>
        </div>
        <F label="Cutoff setting">
          <select className="bsure-select" name="cutoffRuleSettingId">
            <option value="">No cutoff condition</option>
            {cutoffs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </F>
        <div className="bsure-actions" style={{ marginTop: "10px" }}>
          <button className="bsure-button" type="submit">Save rename rule</button>
        </div>
      </Form>
    </div>
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
          )) : <span className="bsure-help">Approve a CSV import first — pincodes will appear here.</span>}
        </div>
      </div>
      <div className="bsure-chip-meta">
        <span>Please use * wildcard to match multiple zip codes.</span>
        <span>Total: {options.length}</span>
      </div>
    </div>
  );
}

function RuleItem({ item, kind, mappings }: { item: ShippingRule; kind: string; mappings: Option[] }) {
  return (
    <article className="bsure-rule-item">
      <div className="bsure-rule-item-top">
        <div>
          <h3>{item.name}</h3>
          <span className={item.enabled ? "bsure-pill active" : "bsure-pill disabled"}>{item.enabled ? "Active" : "Deactivated"}</span>
          <div className="bsure-rule-meta" style={{ marginTop: "4px" }}>Priority {item.priority} · Mapping: {mappings.find((m) => m.id === item.shippingMethodMappingId)?.name || "—"}</div>
          {item.notes && <div className="bsure-rule-meta">{item.notes}</div>}
          <ChipRow items={parseJsonList(item.pincodesJson)} label="Pincodes" />
        </div>
        <Form className="bsure-actions" method="post">
          <input name="id" type="hidden" value={item.id} />
          <button className="bsure-button secondary" name="intent" type="submit" value={`${kind}:toggle`}>Toggle</button>
          <button className="bsure-button danger" name="intent" type="submit" value={`${kind}:delete`}>Delete</button>
        </Form>
      </div>
    </article>
  );
}

function RenameRuleItem({ item, mappings }: { item: ShippingRenameRule; mappings: Option[] }) {
  return (
    <article className="bsure-rule-item">
      <div className="bsure-rule-item-top">
        <div>
          <h3>{item.name}</h3>
          <span className={item.enabled ? "bsure-pill active" : "bsure-pill disabled"}>{item.enabled ? "Active" : "Deactivated"}</span>
          <div className="bsure-rule-meta" style={{ marginTop: "4px" }}>
            Priority {item.priority} · {mappings.find((m) => m.id === item.shippingMethodMappingId)?.name || "—"} → <strong>{item.newLabel || "No label"}</strong>
          </div>
          <ChipRow items={parseJsonList(item.pincodesJson)} label="Pincodes" />
        </div>
        <Form className="bsure-actions" method="post">
          <input name="id" type="hidden" value={item.id} />
          <button className="bsure-button secondary" name="intent" type="submit" value="shippingRename:toggle">Toggle</button>
          <button className="bsure-button danger" name="intent" type="submit" value="shippingRename:delete">Delete</button>
        </Form>
      </div>
    </article>
  );
}

function ChipRow({ items, label }: { items: string[]; label: string }) {
  if (!items.length) return null;
  return (
    <div className="bsure-chip-list" style={{ marginTop: "6px" }}>
      <span className="bsure-help">{label}:</span>
      {items.slice(0, 6).map((item) => <span className="bsure-chip" key={item}>{item}</span>)}
      {items.length > 6 && <span className="bsure-help">+{items.length - 6} more</span>}
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

function Sradio({ defaultChecked, label, pill, sub }: { defaultChecked?: boolean; label: string; pill: string; sub: string }) {
  return (
    <div className="bsure-radio">
      <input defaultChecked={defaultChecked} name="status" type="radio" value={label.toLowerCase()} />
      <span>
        <span className={`bsure-pill ${pill}`}>{label}</span>
        <br />
        <span className="bsure-help">{sub}</span>
      </span>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
