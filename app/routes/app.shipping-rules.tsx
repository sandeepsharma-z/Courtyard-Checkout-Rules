import { useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getActivePincodeRuleOptions } from "../services/pincode-storage.server";
import {
  getRuleManagerData,
  handleRuleManagerAction,
} from "../services/rule-config-storage.server";
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
  const mode: Mode =
    url.searchParams.get("mode") === "rename" ? "rename" : "hide";
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
  const mode = String(formData.get("intent") ?? "").includes("Rename")
    ? "rename"
    : "hide";
  await handleRuleManagerAction(formData);
  return redirect(`/app/shipping-rules?mode=${mode}`);
};

export default function ShippingRulesPage() {
  const { cutoffs, hideRules, mappings, mode, pincodeOptions, renameRules } =
    useLoaderData<typeof loader>();
  const isRename = mode === "rename";

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <Link className="bsure-back" to="/app">
              &larr;
            </Link>
            <h1>
              {isRename
                ? "Update rename shipping methods rule"
                : "Update hide shipping methods rule"}
            </h1>
          </div>
          <Link className="bsure-more" to="/app/publish">
            Publish config
          </Link>
        </div>

        <div className="bsure-rule-shell">
          <ModeTabs mode={mode} />

          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <F label="Name">
              <div className="bsure-name-row">
                <input
                  className="bsure-input bsure-name-input"
                  defaultValue={
                    isRename
                      ? "All Shipping Method Rename"
                      : "All Shipping Method Hide"
                  }
                  maxLength={70}
                  readOnly
                />
                <span className="bsure-char-count">
                  {isRename ? "26" : "24"}/70
                </span>
              </div>
              <span className="bsure-help">
                Optional. Not shown to customers.
              </span>
            </F>
          </section>

          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <h2>Status</h2>
            <div className="bsure-radio-stack" style={{ marginTop: "10px" }}>
              <Sradio
                label="Testing"
                pill="testing"
                sub="Test this rule safely before publishing checkout configuration."
              />
              <Sradio
                defaultChecked
                label="Active"
                pill="active"
                sub="Enabled rules are included when you publish the next config snapshot."
              />
              <Sradio
                label="Deactivated"
                pill="disabled"
                sub="Disabled rules stay local and are not published."
              />
            </div>
          </section>

          <section className="bsure-card" style={{ marginBottom: "12px" }}>
            <h2 className="bsure-target-heading">
              Target{" "}
              <span title="Choose which delivery option family this rule targets.">
                i
              </span>
            </h2>
            <div className="bsure-target-list">
              <div className="bsure-target-row primary">
                <input
                  defaultChecked
                  id="target-ship"
                  name="targetPreview"
                  type="radio"
                  value="ship"
                />
                <label htmlFor="target-ship">
                  <div className="bsure-target-label">Ship</div>
                  <div className="bsure-target-sub">
                    This rule targets shipping methods shown after a shipping
                    address is entered.
                  </div>
                </label>
              </div>
              <div className="bsure-target-row nested">
                <input
                  defaultChecked
                  id="shipment-scope-standard"
                  name="shipmentScopePreview"
                  type="radio"
                  value="all-except-subscriptions"
                />
                <label
                  className="bsure-target-label"
                  htmlFor="shipment-scope-standard"
                >
                  All shipments except subscriptions
                </label>
              </div>
              <div className="bsure-target-row nested">
                <input
                  id="shipment-scope-all"
                  name="shipmentScopePreview"
                  type="radio"
                  value="all"
                />
                <label
                  className="bsure-target-label"
                  htmlFor="shipment-scope-all"
                >
                  All shipments
                </label>
              </div>
            </div>
          </section>

          <div className="bsure-connector">And</div>

          <ShippingRuleForm
            areaGroups={pincodeOptions.areaGroups}
            cutoffs={cutoffs}
            deliveryAvailabilityValues={
              pincodeOptions.deliveryAvailabilityValues
            }
            isRename={isRename}
            mappings={mappings}
            pincodeOptions={pincodeOptions.pincodes}
          />

          <div className="bsure-lastly" style={{ marginTop: "12px" }}>
            <p>
              If the app fails to determine customer location or config is
              missing...
            </p>
            <div className="bsure-if-radio">
              <input
                defaultChecked
                name="fallbackPreview"
                type="radio"
                value="nothing"
              />
              <span>Do nothing</span>
            </div>
            <div className="bsure-if-radio">
              <input name="fallbackPreview" type="radio" value="action" />
              <span>Return no checkout operations until config is fixed</span>
            </div>
          </div>

          <div className="bsure-bottom-bar">
            <Link
              className="bsure-button secondary"
              to="/app/shipping-mappings"
            >
              Manage mappings
            </Link>
            <Link className="bsure-button secondary" to="/app/pincodes">
              View pincodes
            </Link>
            <Link className="bsure-button" to="/app/publish">
              Publish config
            </Link>
          </div>

          <ConfiguredRules
            hideRules={hideRules}
            mappings={mappings}
            renameRules={renameRules}
          />
        </div>
      </div>
    </div>
  );
}

function ModeTabs({ mode }: { mode: Mode }) {
  return (
    <div className="bsure-mode-tabs">
      <Link
        className={mode === "hide" ? "active" : ""}
        to="/app/shipping-rules?mode=hide"
      >
        Hide shipping methods
      </Link>
      <Link
        className={mode === "rename" ? "active" : ""}
        to="/app/shipping-rules?mode=rename"
      >
        Rename shipping methods
      </Link>
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
  const [subCondIds, setSubCondIds] = useState<number[]>([]);
  const [extraAreaIds, setExtraAreaIds] = useState<number[]>([]);
  const hasMappings = mappings.length > 0;

  return (
    <Form method="post">
      <input
        name="intent"
        type="hidden"
        value={isRename ? "shippingRename:create" : "shippingHide:create"}
      />

      <div className="bsure-area-card">
        <div className="bsure-area-head">
          <div>
            <strong>Area 1</strong>
            <span>Select when this rule should run.</span>
          </div>
          <button className="bsure-when-close" title="Collapse" type="button">
            ⌃
          </button>
        </div>

        <div className="bsure-cond-row">
          <ConditionFieldSelect defaultValue="postalCode" />
          <ConditionOperatorSelect defaultValue="any" />
          <button className="bsure-cond-del" disabled type="button">
            Delete
          </button>
        </div>
        <PincodeChips options={pincodeOptions} />

        <div className="bsure-mini-or">And</div>

        <div className="bsure-cond-row">
          <ConditionFieldSelect defaultValue="productTags" />
          <ConditionOperatorSelect defaultValue="any" />
          <button className="bsure-cond-del" disabled type="button">
            Delete
          </button>
        </div>
        <input
          className="bsure-input"
          name="productTags"
          placeholder="Comma-separated product tags from admin config"
        />

        <div className="bsure-mini-or">And</div>

        <div className="bsure-grid-2">
          <select className="bsure-select" name="areaGroups">
            <option value="">Any area group</option>
            {areaGroups.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="bsure-select" name="deliveryAvailabilityText">
            <option value="">Any delivery text</option>
            {deliveryAvailabilityValues.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="bsure-grid-2" style={{ marginTop: "8px" }}>
          <select className="bsure-select" name="cutoffRuleSettingId">
            <option value="">No cutoff condition</option>
            {cutoffs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            className="bsure-input"
            name="priority"
            defaultValue="100"
            type="number"
          />
        </div>

        {subCondIds.map((id) => (
          <div key={id}>
            <div className="bsure-mini-or">And</div>
            <div className="bsure-cond-row">
              <ConditionFieldSelect defaultValue="postalCode" />
              <ConditionOperatorSelect defaultValue="any" />
              <input
                className="bsure-input"
                name="subCondValue"
                placeholder="Enter value…"
                style={{ flex: 1 }}
              />
              <button
                className="bsure-cond-del"
                onClick={() => setSubCondIds((p) => p.filter((x) => x !== id))}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        <div className="bsure-condition-actions">
          <button
            className="bsure-add-link"
            onClick={() => setSubCondIds((p) => [...p, Date.now()])}
            type="button"
          >
            + Add sub-condition
          </button>
          <span>Or</span>
          <button
            className="bsure-add-link"
            onClick={() => setExtraAreaIds((p) => [...p, Date.now()])}
            type="button"
          >
            + Add another condition
          </button>
        </div>
      </div>

      {extraAreaIds.map((id, idx) => (
        <div key={id}>
          <div className="bsure-or-divider">Or</div>
          <ExtraAreaBlock
            areaNum={idx + 2}
            onRemove={() => setExtraAreaIds((p) => p.filter((x) => x !== id))}
            pincodeOptions={pincodeOptions}
          />
        </div>
      ))}

      <div className="bsure-then-card">
        <div className="bsure-then-label">
          {isRename
            ? "Then rename shipping methods like this..."
            : "Then hide shipping methods using..."}
        </div>

        {!hasMappings && (
          <div className="bsure-warning">
            Create shipping method mappings first so this rule can target
            Shopify delivery option names.
            <Link to="/app/shipping-mappings"> Create mapping</Link>
          </div>
        )}

        {!isRename && (
          <select
            className="bsure-select"
            defaultValue="hide"
            name="hideAction"
            style={{ marginBottom: "10px", maxWidth: "260px" }}
          >
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
                    <select
                      className="bsure-select"
                      name="shippingMethodMappingId"
                      required={hasMappings}
                    >
                      <option value="">Select method mapping</option>
                      {mappings.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                {isRename && (
                  <td>
                    <div className="bsure-method-grid">
                      <MethodOperatorSelect defaultValue="renameTo" />
                      <input
                        className="bsure-input"
                        name="newLabel"
                        placeholder="New shipping label"
                        required={hasMappings}
                      />
                    </div>
                  </td>
                )}
                <td>
                  <button
                    className="bsure-cond-del"
                    disabled={methodRows.length === 1}
                    onClick={() =>
                      setMethodRows((rows) =>
                        rows.filter((item) => item !== row),
                      )
                    }
                    type="button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bsure-method-add-row">
              <td colSpan={isRename ? 4 : 3}>
                <button
                  className="bsure-add-link"
                  onClick={() => setMethodRows((rows) => [...rows, Date.now()])}
                  type="button"
                >
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
            <input
              className="bsure-input"
              name="name"
              placeholder={isRename ? "Rename rule label" : "Hide rule label"}
              required
            />
          </F>
          <div
            className="bsure-radio"
            style={{ alignItems: "center", marginTop: "22px" }}
          >
            <input
              defaultChecked
              id="shipping-rule-enabled"
              name="enabled"
              type="checkbox"
            />
            <label htmlFor="shipping-rule-enabled">
              <strong>Enabled</strong>{" "}
              <span className="bsure-help">
                Include in next published config
              </span>
            </label>
          </div>
        </div>
        <F label="Notes" style={{ marginTop: "8px" }}>
          <textarea
            className="bsure-textarea"
            name="notes"
            placeholder="Internal note"
            rows={2}
          />
        </F>
        <div className="bsure-actions" style={{ marginTop: "10px" }}>
          <button
            className="bsure-button"
            disabled={!hasMappings}
            type="submit"
          >
            {isRename ? "Save rename rule" : "Save hide rule"}
          </button>
          <button className="bsure-button secondary" type="reset">
            Cancel
          </button>
        </div>
      </div>
    </Form>
  );
}

function ExtraAreaBlock({
  areaNum,
  onRemove,
  pincodeOptions,
}: {
  areaNum: number;
  onRemove: () => void;
  pincodeOptions: PincodeOption[];
}) {
  const [subCondIds, setSubCondIds] = useState<number[]>([]);
  return (
    <div className="bsure-area-card">
      <div className="bsure-area-head">
        <div>
          <strong>Area {areaNum}</strong>
          <span>Or — match any of these conditions</span>
        </div>
        <button
          className="bsure-when-close"
          onClick={onRemove}
          title="Remove area"
          type="button"
        >
          ×
        </button>
      </div>
      <div className="bsure-cond-row">
        <ConditionFieldSelect defaultValue="postalCode" />
        <ConditionOperatorSelect defaultValue="any" />
        <button className="bsure-cond-del" disabled type="button">
          Delete
        </button>
      </div>
      <PincodeChips options={pincodeOptions} />
      {subCondIds.map((id) => (
        <div key={id}>
          <div className="bsure-mini-or">And</div>
          <div className="bsure-cond-row">
            <ConditionFieldSelect defaultValue="postalCode" />
            <ConditionOperatorSelect defaultValue="any" />
            <input
              className="bsure-input"
              name="subCondValue"
              placeholder="Enter value…"
              style={{ flex: 1 }}
            />
            <button
              className="bsure-cond-del"
              onClick={() => setSubCondIds((p) => p.filter((x) => x !== id))}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      <div className="bsure-condition-actions">
        <button
          className="bsure-add-link"
          onClick={() => setSubCondIds((p) => [...p, Date.now()])}
          type="button"
        >
          + Add sub-condition
        </button>
      </div>
    </div>
  );
}

function ConfiguredRules({
  hideRules,
  mappings,
  renameRules,
}: {
  hideRules: ShippingRule[];
  mappings: Option[];
  renameRules: ShippingRenameRule[];
}) {
  if (!hideRules.length && !renameRules.length) return null;

  return (
    <section className="bsure-card" style={{ marginTop: "24px" }}>
      <div className="bsure-section-top">
        <h2>Configured shipping rules</h2>
        <span className="bsure-help">
          {hideRules.length + renameRules.length} rule
          {hideRules.length + renameRules.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="bsure-rule-list">
        {hideRules.map((item) => (
          <RuleItem
            item={item}
            key={item.id}
            kind="shippingHide"
            mappings={mappings}
            type="Hide"
          />
        ))}
        {renameRules.map((item) => (
          <RuleItem
            item={item}
            key={item.id}
            kind="shippingRename"
            mappings={mappings}
            newLabel={item.newLabel}
            type="Rename"
          />
        ))}
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
  const [selected, setSelected] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [csvMsg, setCsvMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedSet = new Set(selected);

  const suggestions =
    inputValue.length > 0
      ? options
          .filter(
            (o) =>
              !selectedSet.has(o.pincode) &&
              (o.pincode.startsWith(inputValue) ||
                o.district.toLowerCase().includes(inputValue.toLowerCase()) ||
                o.locationName
                  .toLowerCase()
                  .includes(inputValue.toLowerCase())),
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
      <input
        accept=".csv,text/csv,.xlsx,.xls"
        onChange={handleCsvFile}
        ref={fileRef}
        style={{ display: "none" }}
        type="file"
      />

      {selected.map((pincode) => (
        <input key={pincode} name="pincodes" type="hidden" value={pincode} />
      ))}

      <label className="bsure-tag-box">
        {selected.map((pincode) => (
          <span className="bsure-tag" key={pincode}>
            {pincode}
            <button
              className="bsure-tag-x"
              onClick={(e) => {
                e.stopPropagation();
                remove(pincode);
              }}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="bsure-tag-input"
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            selected.length === 0 ? "Type a pincode and press Enter…" : ""
          }
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
              onMouseDown={(e) => {
                e.preventDefault();
                add(o.pincode);
              }}
              type="button"
            >
              <strong>{o.pincode}</strong>
              {o.district && <span> · {o.district}</span>}
              {o.locationName && (
                <span className="bsure-tag-sugg-area"> · {o.locationName}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="bsure-chip-meta">
        <span>
          {csvMsg ||
            (options.length === 0
              ? "Approve a CSV import first, or type pincodes manually."
              : `${selected.length} selected · ${options.length} in active CSV`)}
        </span>
        <span className="bsure-tag-actions">
          <button
            className="bsure-link-btn"
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            ↑ Import from CSV
          </button>
          {selected.length > 0 && (
            <button
              className="bsure-link-btn"
              onClick={() => setSelected([])}
              type="button"
            >
              Clear all
            </button>
          )}
        </span>
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
  const [isEditing, setIsEditing] = useState(false);
  const pincodes = parseJsonList(item.pincodesJson);
  const productTags = parseJsonList(item.productTagsJson);
  const areaGroups = parseJsonList(item.areaGroupsJson);

  return (
    <article className="bsure-rule-item">
      <div className="bsure-rule-item-top">
        <div>
          <h3>{item.name}</h3>
          <span
            className={
              item.enabled ? "bsure-pill active" : "bsure-pill disabled"
            }
          >
            {item.enabled ? "Active" : "Deactivated"}
          </span>
          <div className="bsure-rule-meta" style={{ marginTop: "4px" }}>
            {type} - Priority {item.priority} - Mapping:{" "}
            {mappings.find((m) => m.id === item.shippingMethodMappingId)
              ?.name || "-"}
            {newLabel ? (
              <>
                {" "}
                -&gt; <strong>{newLabel}</strong>
              </>
            ) : null}
          </div>
          <ChipRow items={pincodes} label="Pincodes" />
        </div>
        <div className="bsure-actions">
          <button
            className="bsure-button secondary"
            onClick={() => setIsEditing((value) => !value)}
            type="button"
          >
            {isEditing ? "Cancel edit" : "Edit"}
          </button>
          <Form className="bsure-actions" method="post">
            <input name="id" type="hidden" value={item.id} />
            <button
              className="bsure-button secondary"
              name="intent"
              type="submit"
              value={`${kind}:toggle`}
            >
              Toggle
            </button>
            <button
              className="bsure-button danger"
              name="intent"
              type="submit"
              value={`${kind}:delete`}
            >
              Delete
            </button>
          </Form>
        </div>
      </div>
      {isEditing && (
        <Form className="bsure-edit-form" method="post">
          <input name="id" type="hidden" value={item.id} />
          <input name="intent" type="hidden" value={`${kind}:update`} />
          <div className="bsure-form-row">
            <F label="Rule name">
              <input
                className="bsure-input"
                defaultValue={item.name}
                name="name"
              />
            </F>
            <F label="Priority">
              <input
                className="bsure-input"
                defaultValue={item.priority}
                name="priority"
                type="number"
              />
            </F>
          </div>
          <div className="bsure-radio" style={{ marginTop: "10px" }}>
            <input
              defaultChecked={item.enabled}
              id={`enabled-${item.id}`}
              name="enabled"
              type="checkbox"
            />
            <label htmlFor={`enabled-${item.id}`}>Enabled</label>
          </div>
          <div className="bsure-form-row" style={{ marginTop: "10px" }}>
            <F label="Shipping method mapping">
              <select
                className="bsure-select"
                defaultValue={item.shippingMethodMappingId}
                name="shippingMethodMappingId"
              >
                <option value="">No mapping selected</option>
                {mappings.map((mapping) => (
                  <option key={mapping.id} value={mapping.id}>
                    {mapping.name}
                  </option>
                ))}
              </select>
            </F>
            {kind === "shippingRename" ? (
              <F label="New shipping label">
                <input
                  className="bsure-input"
                  defaultValue={newLabel ?? ""}
                  name="newLabel"
                />
              </F>
            ) : (
              <F label="Cutoff setting ID">
                <input
                  className="bsure-input"
                  defaultValue={item.cutoffRuleSettingId}
                  name="cutoffRuleSettingId"
                />
              </F>
            )}
          </div>
          {kind === "shippingRename" && (
            <input
              name="cutoffRuleSettingId"
              type="hidden"
              value={item.cutoffRuleSettingId}
            />
          )}
          <div className="bsure-form-row" style={{ marginTop: "10px" }}>
            <F label="Pincodes">
              <textarea
                className="bsure-textarea"
                defaultValue={pincodes.join(", ")}
                name="pincodes"
              />
            </F>
            <F label="Product tags">
              <textarea
                className="bsure-textarea"
                defaultValue={productTags.join(", ")}
                name="productTags"
              />
            </F>
          </div>
          <div className="bsure-form-row" style={{ marginTop: "10px" }}>
            <F label="Area groups">
              <textarea
                className="bsure-textarea"
                defaultValue={areaGroups.join(", ")}
                name="areaGroups"
              />
            </F>
            <F label="Delivery text">
              <input
                className="bsure-input"
                defaultValue={item.deliveryAvailabilityText}
                name="deliveryAvailabilityText"
              />
            </F>
          </div>
          <F label="Notes" style={{ marginTop: "10px" }}>
            <textarea
              className="bsure-textarea"
              defaultValue={item.notes}
              name="notes"
            />
          </F>
          <div className="bsure-actions" style={{ marginTop: "10px" }}>
            <button className="bsure-button" type="submit">
              Save changes
            </button>
            <button
              className="bsure-button secondary"
              onClick={() => setIsEditing(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </Form>
      )}
    </article>
  );
}

function ChipRow({ items, label }: { items: string[]; label: string }) {
  if (!items.length) return null;
  return (
    <div className="bsure-chip-list" style={{ marginTop: "6px" }}>
      <span className="bsure-help">{label}:</span>
      {items.slice(0, 6).map((item) => (
        <span className="bsure-chip" key={item}>
          {item}
        </span>
      ))}
      {items.length > 6 && (
        <span className="bsure-help">+{items.length - 6} more</span>
      )}
    </div>
  );
}

function F({
  children,
  label,
  style,
}: {
  children: React.ReactNode;
  label: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="bsure-field" style={style}>
      <span className="bsure-label">{label}</span>
      {children}
    </div>
  );
}

function Sradio({
  defaultChecked,
  label,
  pill,
  sub,
}: {
  defaultChecked?: boolean;
  label: string;
  pill: string;
  sub: string;
}) {
  const id = `shipping-status-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="bsure-radio">
      <input
        defaultChecked={defaultChecked}
        id={id}
        name="statusPreview"
        type="radio"
        value={label.toLowerCase()}
      />
      <label htmlFor={id}>
        <span className={`bsure-pill ${pill}`}>{label}</span>
        <br />
        <span className="bsure-help">{sub}</span>
      </label>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
