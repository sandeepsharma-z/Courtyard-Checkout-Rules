import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getActivePincodeRuleOptions } from "../services/pincode-storage.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";
import { parseJsonList } from "../components/rule-manager-ui";

type Option = { id: string; name: string };
type PincodeOption = {
  id: string;
  pincode: string;
  areaGroup: string;
  deliveryAvailability: string;
  district: string;
  locationName: string;
  state: string;
};
type ShippingRule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  shippingMethodMappingId: string;
  cutoffRuleSettingId: string;
  productTagsJson: string;
  pincodesJson: string;
  areaGroupsJson: string;
  deliveryAvailabilityText: string;
  notes: string;
};
type ShippingRenameRule = ShippingRule & { newLabel: string };
type Mode = "hide" | "rename";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const mode: Mode = url.searchParams.get("mode") === "rename" ? "rename" : "hide";
  const [ruleData, pincodeOptions] = await Promise.all([
    getRuleManagerData(),
    getActivePincodeRuleOptions(),
  ]);

  return {
    cutoffs: ruleData.cutoffRuleSettings,
    hideRules: ruleData.shippingHideRules,
    mappings: ruleData.shippingMethodMappings,
    mode,
    pincodeOptions,
    renameRules: ruleData.shippingRenameRules,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const mode = String(formData.get("intent") ?? "").includes("Rename") ? "rename" : "hide";
  await handleRuleManagerAction(formData);
  return redirect(`/app/shipping-rules?mode=${mode}`);
};

export default function ShippingRulesPage() {
  const { cutoffs, hideRules, mappings, mode, pincodeOptions, renameRules } = useLoaderData<typeof loader>();
  const isRename = mode === "rename";

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <Link className="bsure-back" to="/app">&larr;</Link>
            <h1>{isRename ? "Update rename shipping methods rule" : "Update hide shipping methods rule"}</h1>
          </div>
          <Link className="bsure-more" to="/app/publish">Publish config</Link>
        </div>

        <div className="bsure-rule-shell">
          <ModeTabs mode={mode} />

          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <F label="Name">
              <div className="bsure-name-row">
                <input
                  className="bsure-input bsure-name-input"
                  defaultValue={isRename ? "All Shipping Method Rename" : "All Shipping Method Hide"}
                  maxLength={70}
                  readOnly
                />
                <span className="bsure-char-count">{isRename ? "26" : "24"}/70</span>
              </div>
              <span className="bsure-help">Optional. Not shown to customers.</span>
            </F>
          </section>

          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <h2>Status</h2>
            <div className="bsure-radio-stack" style={{ marginTop: "10px" }}>
              <Sradio label="Testing" pill="testing" sub="Test this rule safely before publishing checkout configuration." />
              <Sradio defaultChecked label="Active" pill="active" sub="Enabled rules are included when you publish the next config snapshot." />
              <Sradio label="Deactivated" pill="disabled" sub="Disabled rules stay local and are not published." />
            </div>
          </section>

          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <h2 className="bsure-target-heading">Target <span title="Choose which delivery option family this rule targets.">i</span></h2>
            <div className="bsure-target-list">
              <div className="bsure-target-row primary">
                <input defaultChecked id="target-ship" name="targetPreview" type="radio" value="ship" />
                <label htmlFor="target-ship">
                  <div className="bsure-target-label">Ship</div>
                  <div className="bsure-target-sub">This rule targets shipping methods shown after a shipping address is entered.</div>
                </label>
              </div>
              <div className="bsure-target-row nested">
                <input defaultChecked id="shipment-scope-standard" name="shipmentScopePreview" type="radio" value="all-except-subscriptions" />
                <label className="bsure-target-label" htmlFor="shipment-scope-standard">All shipments except subscriptions</label>
              </div>
              <div className="bsure-target-row nested">
                <input id="shipment-scope-all" name="shipmentScopePreview" type="radio" value="all" />
                <label className="bsure-target-label" htmlFor="shipment-scope-all">All shipments</label>
              </div>
            </div>
          </section>

          <div className="bsure-connector">And</div>

          <ShippingRuleForm
            areaGroups={pincodeOptions.areaGroups}
            cutoffs={cutoffs}
            deliveryAvailabilityValues={pincodeOptions.deliveryAvailabilityValues}
            isRename={isRename}
            mappings={mappings}
            pincodeOptions={pincodeOptions.pincodes}
          />

          <div className="bsure-lastly" style={{ marginTop: "12px" }}>
            <p>If the app fails to determine customer location or config is missing...</p>
            <div className="bsure-if-radio"><input defaultChecked name="fallbackPreview" type="radio" value="nothing" /><span>Do nothing</span></div>
            <div className="bsure-if-radio"><input name="fallbackPreview" type="radio" value="action" /><span>Return no checkout operations until config is fixed</span></div>
          </div>

          <div className="bsure-bottom-bar">
            <Link className="bsure-button secondary" to="/app/shipping-mappings">Manage mappings</Link>
            <Link className="bsure-button secondary" to="/app/pincodes">View pincodes</Link>
            <Link className="bsure-button" to="/app/publish">Publish config</Link>
          </div>

          <ConfiguredRules hideRules={hideRules} mappings={mappings} renameRules={renameRules} />
        </div>
      </div>
    </div>
  );
}

function ModeTabs({ mode }: { mode: Mode }) {
  return (
    <div className="bsure-mode-tabs">
      <Link className={mode === "hide" ? "active" : ""} to="/app/shipping-rules?mode=hide">Hide shipping methods</Link>
      <Link className={mode === "rename" ? "active" : ""} to="/app/shipping-rules?mode=rename">Rename shipping methods</Link>
    </div>
  );
}

function ShippingRuleForm({
  areaGroups,
  cutoffs,
  deliveryAvailabilityValues,
  isRename,
  mappings,
  pincodeOptions,
}: {
  areaGroups: string[];
  cutoffs: Option[];
  deliveryAvailabilityValues: string[];
  isRename: boolean;
  mappings: Option[];
  pincodeOptions: PincodeOption[];
}) {
  const [methodRows, setMethodRows] = useState([0]);
  const hasMappings = mappings.length > 0;

  return (
    <Form method="post">
      <input name="intent" type="hidden" value={isRename ? "shippingRename:create" : "shippingHide:create"} />

      <div className="bsure-area-card">
        <div className="bsure-area-head">
          <div>
            <strong>Area 1</strong>
            <span>Select when this rule should run.</span>
          </div>
          <button className="bsure-when-close" title="Collapse" type="button">⌃</button>
        </div>

        <div className="bsure-cond-row">
          <ConditionFieldSelect defaultValue="postalCode" />
          <ConditionOperatorSelect defaultValue="any" />
          <button className="bsure-cond-del" disabled type="button">Delete</button>
        </div>
        <PincodeChips options={pincodeOptions} />

        <div className="bsure-mini-or">And</div>

        <div className="bsure-cond-row">
          <ConditionFieldSelect defaultValue="productTags" />
          <ConditionOperatorSelect defaultValue="any" />
          <button className="bsure-cond-del" disabled type="button">Delete</button>
        </div>
        <input className="bsure-input" name="productTags" placeholder="Comma-separated product tags from admin config" />

        <div className="bsure-mini-or">And</div>

        <div className="bsure-grid-2">
          <select className="bsure-select" name="areaGroups">
            <option value="">Any area group</option>
            {areaGroups.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="bsure-select" name="deliveryAvailabilityText">
            <option value="">Any delivery text</option>
            {deliveryAvailabilityValues.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="bsure-grid-2" style={{ marginTop: "8px" }}>
          <select className="bsure-select" name="cutoffRuleSettingId">
            <option value="">No cutoff condition</option>
            {cutoffs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input className="bsure-input" name="priority" defaultValue="100" type="number" />
        </div>

        <div className="bsure-condition-actions">
          <button className="bsure-add-link" type="button">+ Add sub-condition</button>
          <span>Or</span>
          <button className="bsure-add-link" type="button">+ Add another condition</button>
        </div>
      </div>

      <div className="bsure-then-card">
        <div className="bsure-then-label">
          {isRename ? "Then rename shipping methods like this..." : "Then hide shipping methods using..."}
        </div>

        {!hasMappings && (
          <div className="bsure-warning">
            Create shipping method mappings first so this rule can target Shopify delivery option names.
            <Link to="/app/shipping-mappings"> Create mapping</Link>
          </div>
        )}

        {!isRename && (
          <select className="bsure-select" defaultValue="hide" name="hideAction" style={{ marginBottom: "10px", maxWidth: "260px" }}>
            <option value="hide">Hide these shipping methods</option>
            <option value="show">Only show these shipping methods</option>
          </select>
        )}

        <table className="bsure-method-table">
          <thead>
            <tr>
              <th style={{ width: "42px" }}>No.</th>
              <th>Shipping method</th>
              {isRename && <th>New name</th>}
              <th style={{ width: "78px" }}></th>
            </tr>
          </thead>
          <tbody>
            {methodRows.map((row, index) => (
              <tr key={row}>
                <td style={{ color: "#6d7175" }}>{index + 1}</td>
                <td>
                  <div className="bsure-method-grid">
                    <MethodOperatorSelect defaultValue="is" />
                    <select className="bsure-select" name="shippingMethodMappingId" required={hasMappings}>
                      <option value="">Select method mapping</option>
                      {mappings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </div>
                </td>
                {isRename && (
                  <td>
                    <div className="bsure-method-grid">
                      <MethodOperatorSelect defaultValue="renameTo" />
                      <input className="bsure-input" name="newLabel" placeholder="New shipping label" required={hasMappings} />
                    </div>
                  </td>
                )}
                <td>
                  <button
                    className="bsure-cond-del"
                    disabled={methodRows.length === 1}
                    onClick={() => setMethodRows((rows) => rows.filter((item) => item !== row))}
                    type="button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bsure-method-add-row">
              <td colSpan={isRename ? 4 : 3}>
                <button className="bsure-add-link" onClick={() => setMethodRows((rows) => [...rows, Date.now()])} type="button">
                  + Add shipping method
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bsure-card" style={{ marginTop: "12px" }}>
        <div className="bsure-grid-2">
          <F label="Rule name">
            <input className="bsure-input" name="name" placeholder={isRename ? "Rename rule label" : "Hide rule label"} required />
          </F>
          <div className="bsure-radio" style={{ alignItems: "center", marginTop: "22px" }}>
            <input defaultChecked id="shipping-rule-enabled" name="enabled" type="checkbox" />
            <label htmlFor="shipping-rule-enabled"><strong>Enabled</strong> <span className="bsure-help">Include in next published config</span></label>
          </div>
        </div>
        <F label="Notes" style={{ marginTop: "8px" }}>
          <textarea className="bsure-textarea" name="notes" placeholder="Internal note" rows={2} />
        </F>
        <div className="bsure-actions" style={{ marginTop: "10px" }}>
          <button className="bsure-button" disabled={!hasMappings} type="submit">
            {isRename ? "Save rename rule" : "Save hide rule"}
          </button>
          <button className="bsure-button secondary" type="reset">Cancel</button>
        </div>
      </div>
    </Form>
  );
}

function ConfiguredRules({ hideRules, mappings, renameRules }: { hideRules: ShippingRule[]; mappings: Option[]; renameRules: ShippingRenameRule[] }) {
  if (!hideRules.length && !renameRules.length) return null;

  return (
    <section className="bsure-card" style={{ marginTop: "24px" }}>
      <div className="bsure-section-top">
        <h2>Configured shipping rules</h2>
        <span className="bsure-help">{hideRules.length + renameRules.length} rule{hideRules.length + renameRules.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="bsure-rule-list">
        {hideRules.map((item) => <RuleItem item={item} key={item.id} kind="shippingHide" mappings={mappings} type="Hide" />)}
        {renameRules.map((item) => <RuleItem item={item} key={item.id} kind="shippingRename" mappings={mappings} newLabel={item.newLabel} type="Rename" />)}
      </div>
    </section>
  );
}

function ConditionFieldSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select className="bsure-select" defaultValue={defaultValue}>
      <option value="postalCode">Zip code / Postal code</option>
      <option value="productTags">Product tags</option>
      <option value="areaGroup">Area group</option>
      <option value="deliveryText">Delivery text</option>
      <option value="shippingMethod">Shipping method</option>
    </select>
  );
}

function ConditionOperatorSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select className="bsure-select" defaultValue={defaultValue}>
      <option value="any">Has any of these values</option>
      <option value="all">Has all of these values</option>
      <option value="none">Does not have these values</option>
      <option value="contains">Contains</option>
    </select>
  );
}

function MethodOperatorSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select className="bsure-select" defaultValue={defaultValue}>
      <option value="is">Is</option>
      <option value="contains">Contains</option>
      <option value="renameTo">Rename to</option>
    </select>
  );
}

function PincodeChips({ options }: { options: PincodeOption[] }) {
  const top = options.slice(0, 400);
  return (
    <div style={{ marginBottom: "8px" }}>
      <div className="bsure-chip-box">
        <div className="bsure-chip-list">
          {top.length ? top.map((item) => (
            <label className="bsure-chip" key={item.id} title={`${item.locationName} ${item.district} ${item.areaGroup}`}>
              <input name="pincodes" type="checkbox" value={item.pincode} />
              <span>{item.pincode}</span>
              <span aria-hidden="true" className="bsure-chip-remove">x</span>
            </label>
          )) : <span className="bsure-help">Approve a CSV import first. Imported pincodes will appear here automatically.</span>}
        </div>
      </div>
      <div className="bsure-chip-meta">
        <span>Click pincode chips to include them in this condition.</span>
        <span>Total: {options.length}</span>
      </div>
    </div>
  );
}

function RuleItem({
  item,
  kind,
  mappings,
  newLabel,
  type,
}: {
  item: ShippingRule;
  kind: string;
  mappings: Option[];
  newLabel?: string;
  type: string;
}) {
  return (
    <article className="bsure-rule-item">
      <div className="bsure-rule-item-top">
        <div>
          <h3>{item.name}</h3>
          <span className={item.enabled ? "bsure-pill active" : "bsure-pill disabled"}>{item.enabled ? "Active" : "Deactivated"}</span>
          <div className="bsure-rule-meta" style={{ marginTop: "4px" }}>
            {type} - Priority {item.priority} - Mapping: {mappings.find((m) => m.id === item.shippingMethodMappingId)?.name || "-"}
            {newLabel ? <> -&gt; <strong>{newLabel}</strong></> : null}
          </div>
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
  const id = `shipping-status-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="bsure-radio">
      <input defaultChecked={defaultChecked} id={id} name="statusPreview" type="radio" value={label.toLowerCase()} />
      <label htmlFor={id}>
        <span className={`bsure-pill ${pill}`}>{label}</span>
        <br />
        <span className="bsure-help">{sub}</span>
      </label>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
