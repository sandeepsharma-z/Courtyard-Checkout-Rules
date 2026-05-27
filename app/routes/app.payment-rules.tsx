import { useRef, useState } from "react";
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
            <h1>Update hide payment methods rule</h1>
          </div>
          <a className="bsure-more" href="/app/payment-mappings">Manage mappings</a>
        </div>

        <div className="bsure-rule-shell">
          {/* ── Name ── */}
          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <F label="Name">
              <div className="bsure-name-row">
                <input className="bsure-input bsure-name-input" defaultValue="All Payment Method Hide" maxLength={70} name="ruleName" readOnly />
                <span className="bsure-char-count">24/70</span>
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

          <div className="bsure-connector">And</div>

          {/* ── HIDE RULE FORM ── */}
          <WhenThenHide areaGroups={pincodeOptions.areaGroups} cutoffs={cutoffs} deliveryAvailabilityValues={pincodeOptions.deliveryAvailabilityValues} mappings={mappings} pincodeOptions={pincodeOptions.pincodes} />

          {/* ── If app fails ── */}
          <div className="bsure-lastly" style={{ marginTop: "12px" }}>
            <p>If the app fails to determine the time/date or customer location...</p>
            <div className="bsure-if-radio"><input defaultChecked name="fallback" type="radio" value="nothing" /><span>Do nothing</span></div>
            <div className="bsure-if-radio"><input name="fallback" type="radio" value="action" /><span>Do this action</span></div>
          </div>

          {/* ── Actions ── */}
          <div className="bsure-bottom-bar">
            <a className="bsure-button secondary" href="/app/payment-mappings">Manage mappings</a>
            <a className="bsure-button secondary" href="/app/pincodes">View pincodes</a>
            <a className="bsure-button" href="/app/publish">Publish config</a>
          </div>

          {/* ── Existing rules ── */}
          {rules.length > 0 && (
            <section className="bsure-card" style={{ marginTop: "24px" }}>
              <div className="bsure-section-top">
                <h2>Configured payment hide rules</h2>
                <span className="bsure-help">{rules.length} rule{rules.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="bsure-rule-list">
                {rules.map((item) => <RuleItem item={item} key={item.id} mappings={mappings} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function WhenThenHide({ areaGroups, cutoffs, deliveryAvailabilityValues, mappings, pincodeOptions }: { areaGroups: string[]; cutoffs: Option[]; deliveryAvailabilityValues: string[]; mappings: Option[]; pincodeOptions: PincodeOption[] }) {
  const [subCondIds, setSubCondIds] = useState<number[]>([]);
  const [extraAreaIds, setExtraAreaIds] = useState<number[]>([]);
  return (
    <Form method="post">
      <input name="intent" type="hidden" value="paymentHide:create" />

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

        {/* Payment method condition */}
        <div className="bsure-cond-row">
          <select className="bsure-select" disabled><option>Payment method</option></select>
          <select className="bsure-select" disabled><option>Matches configured mapping</option></select>
          <button className="bsure-cond-del" disabled type="button">🗑</button>
        </div>
        <div style={{ marginBottom: "8px" }}>
          <select className="bsure-select" name="paymentMethodMappingId" style={{ width: "100%" }}>
            <option value="">Select payment method mapping</option>
            {mappings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div className="bsure-mini-or">And</div>

        {/* Shipping method text condition */}
        <div className="bsure-cond-row">
          <select className="bsure-select" disabled><option>Selected shipping method</option></select>
          <select className="bsure-select" disabled><option>Contains text</option></select>
          <button className="bsure-cond-del" disabled type="button">🗑</button>
        </div>
        <div style={{ marginBottom: "8px" }}>
          <input className="bsure-input" name="selectedShippingContains" placeholder="Leave blank to match any shipping method" style={{ width: "100%" }} />
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

        {subCondIds.map((id) => (
          <div key={id}>
            <div className="bsure-mini-or">And</div>
            <div className="bsure-cond-row">
              <ConditionFieldSelect defaultValue="postalCode" />
              <ConditionOperatorSelect defaultValue="any" />
              <input className="bsure-input" name="subCondValue" placeholder="Enter value…" style={{ flex: 1 }} />
              <button className="bsure-cond-del" onClick={() => setSubCondIds((p) => p.filter((x) => x !== id))} type="button">Delete</button>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "8px" }}>
          <button className="bsure-add-link" onClick={() => setSubCondIds((p) => [...p, Date.now()])} type="button">+ Add sub-condition</button>
          <span style={{ color: "#d4d4d4" }}>|</span>
          <span className="bsure-mini-or" style={{ margin: 0 }}>Or</span>
          <span style={{ color: "#d4d4d4" }}>|</span>
          <button className="bsure-add-link" onClick={() => setExtraAreaIds((p) => [...p, Date.now()])} type="button">+ Add another condition</button>
        </div>
      </div>

      {extraAreaIds.map((id, idx) => (
        <div key={id}>
          <div className="bsure-or-divider">Or</div>
          <ExtraAreaBlock
            areaGroups={areaGroups}
            areaNum={idx + 2}
            deliveryAvailabilityValues={deliveryAvailabilityValues}
            onRemove={() => setExtraAreaIds((p) => p.filter((x) => x !== id))}
            pincodeOptions={pincodeOptions}
          />
        </div>
      ))}

      {/* Then block */}
      <div style={{ marginTop: "12px", padding: "14px", background: "#fff", border: "1px solid #d4d4d4", borderRadius: "8px" }}>
        <div className="bsure-then-label">Then hide payment methods...</div>
        <table className="bsure-method-table">
          <thead>
            <tr><th>No.</th><th>Payment method mapping</th><th></th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ color: "#6d7175", width: "40px" }}>1</td>
              <td>
                <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px" }}>
                  <select className="bsure-select" disabled><option>Is</option></select>
                  <select className="bsure-select" name="paymentMethodMappingId_then">
                    <option value="">Select mapping</option>
                    {mappings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </td>
              <td style={{ width: "40px" }}><button className="bsure-cond-del" disabled type="button">🗑</button></td>
            </tr>
            <tr className="bsure-method-add-row">
              <td colSpan={3}><button className="bsure-add-link" type="button">+ Add payment method</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rule meta */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px" }}>
        <F label="Rule name"><input className="bsure-input" name="name" placeholder="Payment hide rule label" /></F>
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
      <F label="Product tags (optional)" style={{ marginTop: "8px" }}>
        <input className="bsure-input" name="productTags" placeholder="Comma-separated product tags" />
        <span className="bsure-help">No live effect until payment Function is activated.</span>
      </F>
      <F label="Notes" style={{ marginTop: "8px" }}>
        <textarea className="bsure-textarea" name="notes" placeholder="Internal note" rows={2} />
      </F>
      <div className="bsure-actions" style={{ marginTop: "10px" }}>
        <button className="bsure-button" type="submit">Save payment hide rule</button>
      </div>
    </Form>
  );
}

function ExtraAreaBlock({ areaGroups, areaNum, deliveryAvailabilityValues, onRemove, pincodeOptions }: { areaGroups: string[]; areaNum: number; deliveryAvailabilityValues: string[]; onRemove: () => void; pincodeOptions: PincodeOption[] }) {
  const [subCondIds, setSubCondIds] = useState<number[]>([]);
  return (
    <div className="bsure-when-card">
      <div className="bsure-when-header">
        <div>
          <div className="bsure-when-title">Area {areaNum} — Or</div>
          <div className="bsure-when-sub">Match any of these conditions instead</div>
        </div>
        <button className="bsure-when-close" onClick={onRemove} title="Remove area" type="button">×</button>
      </div>
      <div className="bsure-cond-row">
        <ConditionFieldSelect defaultValue="postalCode" />
        <ConditionOperatorSelect defaultValue="any" />
        <button className="bsure-cond-del" disabled type="button">Delete</button>
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
      {subCondIds.map((id) => (
        <div key={id}>
          <div className="bsure-mini-or">And</div>
          <div className="bsure-cond-row">
            <ConditionFieldSelect defaultValue="postalCode" />
            <ConditionOperatorSelect defaultValue="any" />
            <input className="bsure-input" name="subCondValue" placeholder="Enter value…" style={{ flex: 1 }} />
            <button className="bsure-cond-del" onClick={() => setSubCondIds((p) => p.filter((x) => x !== id))} type="button">Delete</button>
          </div>
        </div>
      ))}
      <div className="bsure-condition-actions">
        <button className="bsure-add-link" onClick={() => setSubCondIds((p) => [...p, Date.now()])} type="button">+ Add sub-condition</button>
      </div>
    </div>
  );
}

function ConditionFieldSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select className="bsure-select" defaultValue={defaultValue}>
      <option value="postalCode">Zip code / Postal code</option>
      <option value="productTags">Product tags</option>
      <option value="areaGroup">Area group</option>
      <option value="deliveryText">Delivery text</option>
      <option value="paymentMethod">Payment method</option>
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

function PincodeChips({ options }: { options: PincodeOption[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [csvMsg, setCsvMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedSet = new Set(selected);

  const suggestions = inputValue.length > 0
    ? options
        .filter(
          (o) =>
            !selectedSet.has(o.pincode) &&
            (o.pincode.startsWith(inputValue) ||
              o.district.toLowerCase().includes(inputValue.toLowerCase()) ||
              o.locationName.toLowerCase().includes(inputValue.toLowerCase())),
        )
        .slice(0, 25)
    : [];

  const add = (pincode: string) => {
    const val = pincode.trim();
    if (val && !selectedSet.has(val)) setSelected((p) => [...p, val]);
    setInputValue("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const remove = (pincode: string) =>
    setSelected((p) => p.filter((x) => x !== pincode));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      add(inputValue);
    } else if (e.key === "Backspace" && !inputValue && selected.length > 0) {
      setSelected((p) => p.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const matches = text.match(/\b[1-9]\d{5}\b/g) ?? [];
    const unique = [...new Set(matches)];
    let added = 0;
    setSelected((prev) => {
      const exist = new Set(prev);
      const newOnes = unique.filter((p) => !exist.has(p));
      added = newOnes.length;
      return [...prev, ...newOnes];
    });
    setCsvMsg(`${unique.length} pincodes found, ${added} added`);
    setTimeout(() => setCsvMsg(""), 4000);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="bsure-tag-wrap">
      {selected.map((pincode) => (
        <input key={pincode} name="pincodes" type="hidden" value={pincode} />
      ))}

      <input accept=".csv,.txt,.xlsx" onChange={handleCsvFile} ref={fileRef} style={{ display: "none" }} type="file" />

      <label className="bsure-tag-box">
        {selected.map((pincode) => (
          <span className="bsure-tag" key={pincode}>
            {pincode}
            <button
              className="bsure-tag-x"
              onClick={(e) => { e.stopPropagation(); remove(pincode); }}
              type="button"
            >×</button>
          </span>
        ))}
        <input
          className="bsure-tag-input"
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? "Type a pincode and press Enter…" : ""}
          ref={inputRef}
          type="text"
          value={inputValue}
        />
      </label>

      {open && suggestions.length > 0 && (
        <div className="bsure-tag-suggestions">
          {suggestions.map((o) => (
            <button
              className="bsure-tag-suggestion"
              key={o.id}
              onMouseDown={(e) => { e.preventDefault(); add(o.pincode); }}
              type="button"
            >
              <strong>{o.pincode}</strong>
              {o.district && <span> · {o.district}</span>}
              {o.locationName && <span className="bsure-tag-sugg-area"> · {o.locationName}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="bsure-chip-meta">
        <span>
          {csvMsg || (options.length === 0
            ? "Approve a CSV import first."
            : `${selected.length} selected · ${options.length} available from CSV`)}
        </span>
        <span className="bsure-tag-actions">
          <button className="bsure-link-btn" onClick={() => fileRef.current?.click()} type="button">
            ↑ Import from CSV
          </button>
          {selected.length > 0 && (
            <button className="bsure-link-btn" onClick={() => setSelected([])} type="button">
              Clear all
            </button>
          )}
        </span>
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

function RuleItem({ item, mappings }: { item: PaymentHideRule; mappings: Option[] }) {
  return (
    <article className="bsure-rule-item">
      <div className="bsure-rule-item-top">
        <div>
          <h3>{item.name}</h3>
          <span className={item.enabled ? "bsure-pill active" : "bsure-pill disabled"}>{item.enabled ? "Active" : "Deactivated"}</span>
          <div className="bsure-rule-meta" style={{ marginTop: "6px" }}>
            Priority {item.priority} &nbsp;·&nbsp; Mapping: {mappings.find((m) => m.id === item.paymentMethodMappingId)?.name || "Unmapped"}
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
