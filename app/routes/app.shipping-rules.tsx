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
  selectedShippingMethodsJson: string;
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
  const { cutoffs, hideRules, mode, pincodeOptions, renameRules } =
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

          {isRename ? (
            <ShippingRenameMultiForm
              areaGroups={pincodeOptions.areaGroups}
              cutoffs={cutoffs}
              deliveryAvailabilityValues={
                pincodeOptions.deliveryAvailabilityValues
              }
              pincodeOptions={pincodeOptions.pincodes}
            />
          ) : (
            <ShippingHideMultiForm
              areaGroups={pincodeOptions.areaGroups}
              cutoffs={cutoffs}
              deliveryAvailabilityValues={
                pincodeOptions.deliveryAvailabilityValues
              }
              pincodeOptions={pincodeOptions.pincodes}
            />
          )}

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
            <Link className="bsure-button secondary" to="/app/pincodes">
              View pincodes
            </Link>
            <Link className="bsure-button" to="/app/publish">
              Publish config
            </Link>
          </div>

          <ConfiguredRules
            hideRules={hideRules}
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

type MethodRow = { id: number; operator: string; value: string; newLabel: string };


function ShippingRenameMultiForm({
  areaGroups,
  cutoffs,
  deliveryAvailabilityValues,
  pincodeOptions,
}: {
  areaGroups: string[];
  cutoffs: { id: string; name: string }[];
  deliveryAvailabilityValues: string[];
  pincodeOptions: PincodeOption[];
}) {
  const [blockIds, setBlockIds] = useState<number[]>([0]);
  const nextId = useRef(1);

  const addBlock = () => setBlockIds((p) => [...p, nextId.current++]);
  const removeBlock = (id: number) =>
    setBlockIds((p) => p.filter((x) => x !== id));

  return (
    <Form method="post">
      <input name="intent" type="hidden" value="shippingRename:createMulti" />
      <input name="blockCount" type="hidden" value={blockIds.length} />

      {blockIds.map((id, idx) => (
        <div key={id}>
          {idx > 0 && <div className="bsure-connector">Then</div>}
          <RenameBlock
            areaGroups={areaGroups}
            cutoffs={cutoffs}
            deliveryAvailabilityValues={deliveryAvailabilityValues}
            idx={idx}
            onRemove={() => removeBlock(id)}
            pincodeOptions={pincodeOptions}
            showRemove={blockIds.length > 1}
          />
        </div>
      ))}

      <div className="bsure-add-block-row">
        <button className="bsure-add-link" onClick={addBlock} type="button">
          + Add another condition
        </button>
      </div>

      <div className="bsure-card" style={{ marginTop: "12px" }}>
        <div className="bsure-grid-2">
          <F label="Rule name">
            <input
              className="bsure-input"
              name="name"
              placeholder="Rename rule label"
              required
            />
          </F>
          <F label="Priority">
            <input
              className="bsure-input"
              defaultValue="100"
              name="priority"
              type="number"
            />
          </F>
        </div>
        <div className="bsure-radio" style={{ marginTop: "10px" }}>
          <input
            defaultChecked
            id="shipping-rename-enabled"
            name="enabled"
            type="checkbox"
          />
          <label htmlFor="shipping-rename-enabled">
            <strong>Enabled</strong>{" "}
            <span className="bsure-help">Include in next published config</span>
          </label>
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
          <button className="bsure-button" type="submit">
            Save rename rules
          </button>
          <button className="bsure-button secondary" type="reset">
            Cancel
          </button>
        </div>
      </div>
    </Form>
  );
}

function RenameBlock({
  areaGroups,
  cutoffs,
  deliveryAvailabilityValues,
  idx,
  onRemove,
  pincodeOptions,
  showRemove,
}: {
  areaGroups: string[];
  cutoffs: { id: string; name: string }[];
  deliveryAvailabilityValues: string[];
  idx: number;
  onRemove: () => void;
  pincodeOptions: PincodeOption[];
  showRemove: boolean;
}) {
  const [methodRows, setMethodRows] = useState<MethodRow[]>([
    { id: 0, operator: "is", value: "", newLabel: "" },
  ]);

  const updateMethodRow = (id: number, field: keyof MethodRow, val: string) => {
    setMethodRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    );
  };

  const methodsJson = JSON.stringify(
    methodRows.map((r) => ({
      operator: r.operator,
      matchValue: r.value,
      newLabel: r.newLabel,
    })),
  );

  return (
    <div>
      <input
        name={`selectedShippingMethodsJson_${idx}`}
        readOnly
        type="hidden"
        value={methodsJson}
      />

      <div className="bsure-area-card">
        <div className="bsure-area-head">
          <div>
            <strong>When (Area {idx + 1})</strong>
            <span>Select when this rule should run.</span>
          </div>
          {showRemove && (
            <button
              className="bsure-when-close"
              onClick={onRemove}
              title="Remove"
              type="button"
            >
              ×
            </button>
          )}
        </div>

        <div className="bsure-cond-row">
          <ConditionFieldSelect defaultValue="postalCode" />
          <ConditionOperatorSelect defaultValue="any" />
          <button className="bsure-cond-del" disabled type="button">
            Delete
          </button>
        </div>
        <PincodeChips fieldName={`pincodes_${idx}`} options={pincodeOptions} />

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
          name={`productTags_${idx}`}
          placeholder="Comma-separated product tags from admin config"
        />

        <div className="bsure-mini-or">And</div>

        <div className="bsure-grid-2">
          <select className="bsure-select" name={`areaGroups_${idx}`}>
            <option value="">Any area group</option>
            {areaGroups.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="bsure-select"
            name={`deliveryAvailabilityText_${idx}`}
          >
            <option value="">Any delivery text</option>
            {deliveryAvailabilityValues.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="bsure-grid-2" style={{ marginTop: "8px" }}>
          <select className="bsure-select" name={`cutoffRuleSettingId_${idx}`}>
            <option value="">No cutoff condition</option>
            {cutoffs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bsure-then-card">
        <div className="bsure-then-label">
          Then rename shipping methods like this...
        </div>

        <table className="bsure-method-table">
          <thead>
            <tr>
              <th style={{ width: "42px" }}>No.</th>
              <th>Shipping method</th>
              <th>New name</th>
              <th style={{ width: "78px" }}></th>
            </tr>
          </thead>
          <tbody>
            {methodRows.map((row, index) => (
              <tr key={row.id}>
                <td style={{ color: "#6d7175" }}>{index + 1}</td>
                <td>
                  <div className="bsure-method-grid">
                    <select
                      className="bsure-select"
                      onChange={(e) =>
                        updateMethodRow(row.id, "operator", e.target.value)
                      }
                      value={row.operator}
                    >
                      <option value="is">Is</option>
                      <option value="contains">Contains</option>
                      <option value="starts_with">Starts with</option>
                      <option value="ends_with">Ends with</option>
                    </select>
                    <input
                      className="bsure-input"
                      onChange={(e) =>
                        updateMethodRow(row.id, "value", e.target.value)
                      }
                      placeholder="Shipping method name from admin config"
                      value={row.value}
                    />
                  </div>
                </td>
                <td>
                  <input
                    className="bsure-input"
                    onChange={(e) =>
                      updateMethodRow(row.id, "newLabel", e.target.value)
                    }
                    placeholder="New shipping label"
                    value={row.newLabel}
                  />
                </td>
                <td>
                  <button
                    className="bsure-cond-del"
                    disabled={methodRows.length === 1}
                    onClick={() =>
                      setMethodRows((rows) =>
                        rows.filter((item) => item.id !== row.id),
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
              <td colSpan={4}>
                <button
                  className="bsure-add-link"
                  onClick={() =>
                    setMethodRows((rows) => [
                      ...rows,
                      { id: Date.now(), operator: "is", value: "", newLabel: "" },
                    ])
                  }
                  type="button"
                >
                  + Add shipping method
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShippingHideMultiForm({
  areaGroups,
  cutoffs,
  deliveryAvailabilityValues,
  pincodeOptions,
}: {
  areaGroups: string[];
  cutoffs: { id: string; name: string }[];
  deliveryAvailabilityValues: string[];
  pincodeOptions: PincodeOption[];
}) {
  const [blockIds, setBlockIds] = useState<number[]>([0]);
  const nextId = useRef(1);

  const addBlock = () => setBlockIds((p) => [...p, nextId.current++]);
  const removeBlock = (id: number) =>
    setBlockIds((p) => p.filter((x) => x !== id));

  return (
    <Form method="post">
      <input name="intent" type="hidden" value="shippingHide:createMulti" />
      <input name="blockCount" type="hidden" value={blockIds.length} />

      {blockIds.map((id, idx) => (
        <div key={id}>
          {idx > 0 && <div className="bsure-connector">Then</div>}
          <HideBlock
            areaGroups={areaGroups}
            cutoffs={cutoffs}
            deliveryAvailabilityValues={deliveryAvailabilityValues}
            idx={idx}
            onRemove={() => removeBlock(id)}
            pincodeOptions={pincodeOptions}
            showRemove={blockIds.length > 1}
          />
        </div>
      ))}

      <div className="bsure-add-block-row">
        <button className="bsure-add-link" onClick={addBlock} type="button">
          + Add another condition
        </button>
      </div>

      <div className="bsure-card" style={{ marginTop: "12px" }}>
        <div className="bsure-grid-2">
          <F label="Rule name">
            <input
              className="bsure-input"
              name="name"
              placeholder="Hide rule label"
              required
            />
          </F>
          <F label="Priority">
            <input
              className="bsure-input"
              defaultValue="100"
              name="priority"
              type="number"
            />
          </F>
        </div>
        <div className="bsure-radio" style={{ marginTop: "10px" }}>
          <input
            defaultChecked
            id="shipping-hide-enabled"
            name="enabled"
            type="checkbox"
          />
          <label htmlFor="shipping-hide-enabled">
            <strong>Enabled</strong>{" "}
            <span className="bsure-help">Include in next published config</span>
          </label>
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
          <button className="bsure-button" type="submit">
            Save hide rules
          </button>
          <button className="bsure-button secondary" type="reset">
            Cancel
          </button>
        </div>
      </div>
    </Form>
  );
}

function HideBlock({
  areaGroups,
  cutoffs,
  deliveryAvailabilityValues,
  idx,
  onRemove,
  pincodeOptions,
  showRemove,
}: {
  areaGroups: string[];
  cutoffs: { id: string; name: string }[];
  deliveryAvailabilityValues: string[];
  idx: number;
  onRemove: () => void;
  pincodeOptions: PincodeOption[];
  showRemove: boolean;
}) {
  const [methodRows, setMethodRows] = useState<MethodRow[]>([
    { id: 0, operator: "is", value: "", newLabel: "" },
  ]);

  const updateMethodRow = (id: number, field: keyof MethodRow, val: string) => {
    setMethodRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    );
  };

  const methodsJson = JSON.stringify(
    methodRows.map((r) => ({ operator: r.operator, value: r.value })),
  );

  return (
    <div>
      <input
        name={`selectedShippingMethodsJson_${idx}`}
        readOnly
        type="hidden"
        value={methodsJson}
      />

      <div className="bsure-area-card">
        <div className="bsure-area-head">
          <div>
            <strong>When (Area {idx + 1})</strong>
            <span>Select when this rule should run.</span>
          </div>
          {showRemove && (
            <button
              className="bsure-when-close"
              onClick={onRemove}
              title="Remove"
              type="button"
            >
              ×
            </button>
          )}
        </div>

        <div className="bsure-cond-row">
          <ConditionFieldSelect defaultValue="postalCode" />
          <ConditionOperatorSelect defaultValue="any" />
          <button className="bsure-cond-del" disabled type="button">
            Delete
          </button>
        </div>
        <PincodeChips fieldName={`pincodes_${idx}`} options={pincodeOptions} />

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
          name={`productTags_${idx}`}
          placeholder="Comma-separated product tags from admin config"
        />

        <div className="bsure-mini-or">And</div>

        <div className="bsure-grid-2">
          <select className="bsure-select" name={`areaGroups_${idx}`}>
            <option value="">Any area group</option>
            {areaGroups.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="bsure-select"
            name={`deliveryAvailabilityText_${idx}`}
          >
            <option value="">Any delivery text</option>
            {deliveryAvailabilityValues.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="bsure-grid-2" style={{ marginTop: "8px" }}>
          <select className="bsure-select" name={`cutoffRuleSettingId_${idx}`}>
            <option value="">No cutoff condition</option>
            {cutoffs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bsure-then-card">
        <div className="bsure-then-label">Then hide shipping methods...</div>

        <select
          className="bsure-select"
          defaultValue="hide"
          name={`hideAction_${idx}`}
          style={{ marginBottom: "10px", maxWidth: "260px" }}
        >
          <option value="hide">Hide these shipping methods</option>
          <option value="show">Only show these shipping methods</option>
        </select>

        <table className="bsure-method-table">
          <thead>
            <tr>
              <th style={{ width: "42px" }}>No.</th>
              <th>Shipping method</th>
              <th style={{ width: "78px" }}></th>
            </tr>
          </thead>
          <tbody>
            {methodRows.map((row, index) => (
              <tr key={row.id}>
                <td style={{ color: "#6d7175" }}>{index + 1}</td>
                <td>
                  <div className="bsure-method-grid">
                    <select
                      className="bsure-select"
                      onChange={(e) =>
                        updateMethodRow(row.id, "operator", e.target.value)
                      }
                      value={row.operator}
                    >
                      <option value="is">Is</option>
                      <option value="contains">Contains</option>
                      <option value="starts_with">Starts with</option>
                      <option value="ends_with">Ends with</option>
                    </select>
                    <input
                      className="bsure-input"
                      onChange={(e) =>
                        updateMethodRow(row.id, "value", e.target.value)
                      }
                      placeholder="Shipping method name from admin config"
                      value={row.value}
                    />
                  </div>
                </td>
                <td>
                  <button
                    className="bsure-cond-del"
                    disabled={methodRows.length === 1}
                    onClick={() =>
                      setMethodRows((rows) =>
                        rows.filter((item) => item.id !== row.id),
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
              <td colSpan={3}>
                <button
                  className="bsure-add-link"
                  onClick={() =>
                    setMethodRows((rows) => [
                      ...rows,
                      {
                        id: Date.now(),
                        operator: "is",
                        value: "",
                        newLabel: "",
                      },
                    ])
                  }
                  type="button"
                >
                  + Add shipping method
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}


function ConfiguredRules({
  hideRules,
  renameRules,
}: {
  hideRules: ShippingRule[];
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
            type="Hide"
          />
        ))}
        {renameRules.map((item) => (
          <RuleItem
            item={item}
            key={item.id}
            kind="shippingRename"
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

function PincodeChips({
  fieldName = "pincodes",
  options,
}: {
  fieldName?: string;
  options: PincodeOption[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const addBulk = (raw: string) => {
    const vals = raw.split(/[,\n\r\s]+/).map((v) => v.trim()).filter(Boolean);
    if (!vals.length) return;
    setSelected((prev) => {
      const exist = new Set(prev);
      return [...prev, ...vals.filter((v) => !exist.has(v))];
    });
    setInputValue("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const add = (pincode: string) => addBulk(pincode);

  const remove = (pincode: string) =>
    setSelected((p) => p.filter((x) => x !== pincode));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      addBulk(inputValue);
    } else if (e.key === "Backspace" && !inputValue && selected.length > 0) {
      setSelected((p) => p.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text.includes(",") || text.includes("\n")) {
      e.preventDefault();
      addBulk(text);
    }
  };

  return (
    <div className="bsure-tag-wrap">
      {selected.map((pincode) => (
        <input key={pincode} name={fieldName} type="hidden" value={pincode} />
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
          onPaste={handlePaste}
          placeholder={
            selected.length === 0 ? "Type or paste pincodes, separate with comma or Enter…" : ""
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
        <span>{selected.length > 0 ? `${selected.length} selected` : "Type a pincode and press Enter to add."}</span>
        {selected.length > 0 && (
          <button
            className="bsure-link-btn"
            onClick={() => setSelected([])}
            type="button"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function RuleItem({
  item,
  kind,
  newLabel,
  type,
}: {
  item: ShippingRule;
  kind: string;
  newLabel?: string;
  type: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const pincodes = parseJsonList(item.pincodesJson);
  const productTags = parseJsonList(item.productTagsJson);
  const areaGroups = parseJsonList(item.areaGroupsJson);

  const selectedMethods = (() => {
    try {
      return JSON.parse(item.selectedShippingMethodsJson) as Array<{
        operator: string;
        value?: string;
        matchValue?: string;
        newLabel?: string;
      }>;
    } catch {
      return [];
    }
  })();

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
            {type} - Priority {item.priority}
            {selectedMethods.length > 0 && (
              <> - Methods: {selectedMethods.map((m) => m.value ?? m.matchValue).filter(Boolean).join(", ")}</>
            )}
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
          <input
            name="selectedShippingMethodsJson"
            type="hidden"
            defaultValue={item.selectedShippingMethodsJson}
          />
          <input
            name="shippingMethodMappingId"
            type="hidden"
            value={item.shippingMethodMappingId}
          />
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
          {kind === "shippingRename" ? (
            <>
              <F label="New shipping label" style={{ marginTop: "10px" }}>
                <input
                  className="bsure-input"
                  defaultValue={newLabel ?? ""}
                  name="newLabel"
                />
              </F>
              <input
                name="cutoffRuleSettingId"
                type="hidden"
                value={item.cutoffRuleSettingId}
              />
            </>
          ) : (
            <F label="Cutoff setting ID" style={{ marginTop: "10px" }}>
              <input
                className="bsure-input"
                defaultValue={item.cutoffRuleSettingId}
                name="cutoffRuleSettingId"
              />
            </F>
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

export const headers: HeadersFunction = (headersArgs: Parameters<HeadersFunction>[0]) =>
  boundary.headers(headersArgs);
