import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getActivePincodeRuleOptions } from "../services/pincode-storage.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";
import { parseJsonList } from "../components/rule-manager-ui";

type MethodMapping = { id: string; name: string };
type CutoffSetting = { id: string; name: string };
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const [ruleData, pincodeOptions] = await Promise.all([
    getRuleManagerData(),
    getActivePincodeRuleOptions(),
  ]);

  return {
    hideRules: ruleData.shippingHideRules,
    renameRules: ruleData.shippingRenameRules,
    mappings: ruleData.shippingMethodMappings,
    cutoffs: ruleData.cutoffRuleSettings,
    pincodeOptions,
  };
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
            <a className="bsure-back" href="/app">
              ←
            </a>
            <h1>Update shipping hide/rename checkout rule</h1>
          </div>
          <a className="bsure-more" href="/app/publish">Publish config</a>
        </div>

        <div className="bsure-flow">
          <section className="bsure-card">
            <Field label="Name">
              <input className="bsure-input" readOnly value="All Shipping Method Rules" />
              <span className="bsure-help">Admin label. Not shown to customers.</span>
            </Field>
          </section>

          <section className="bsure-card">
            <h2>Status</h2>
            <div className="bsure-radio-stack">
              <div className="bsure-radio">
                <input aria-label="Testing status" name="status-preview" type="radio" />
                <span>
                  <span className="bsure-pill testing">Testing</span>
                  <br />
                  <span className="bsure-help">Configure and preview rules before publishing. This does not affect checkout until config is published and the Function is active.</span>
                </span>
              </div>
              <div className="bsure-radio">
                <input aria-label="Active status" defaultChecked name="status-preview" type="radio" />
                <span>
                  <span className="bsure-pill active">Active</span>
                  <br />
                  <span className="bsure-help">Enabled rules will be included in the next published schema v2 configuration.</span>
                </span>
              </div>
              <div className="bsure-radio">
                <input aria-label="Deactivated status" name="status-preview" type="radio" />
                <span>
                  <span className="bsure-pill disabled">Deactivated</span>
                  <br />
                  <span className="bsure-help">Toggle individual rules off to keep them local without publishing them as active configuration.</span>
                </span>
              </div>
            </div>
          </section>

          <section className="bsure-card">
            <h2>Behavior</h2>
            <div className="bsure-radio-stack">
              <div className="bsure-radio">
                <input aria-label="Hide matching shipping methods" defaultChecked name="behavior-preview" type="radio" />
                <span>
                  <strong>Hide matching shipping methods</strong>
                  <br />
                  <span className="bsure-help">When selected pincode and method mapping match, the delivery customization hides that method.</span>
                </span>
              </div>
              <div className="bsure-radio">
                <input aria-label="Rename matching shipping methods" name="behavior-preview" type="radio" />
                <span>
                  <strong>Rename matching shipping methods</strong>
                  <br />
                  <span className="bsure-help">Rename labels come from admin configuration only. Hide rules still take priority over rename rules.</span>
                </span>
              </div>
            </div>
          </section>

          <div className="bsure-connector">And</div>

          <RuleEditor
            areaGroups={pincodeOptions.areaGroups}
            cutoffs={cutoffs}
            deliveryAvailabilityValues={pincodeOptions.deliveryAvailabilityValues}
            intent="shippingHide:create"
            mappings={mappings}
            pincodeOptions={pincodeOptions.pincodes}
            title="When..."
            type="hide"
          />

          <div className="bsure-connector">Or</div>

          <RuleEditor
            areaGroups={pincodeOptions.areaGroups}
            cutoffs={cutoffs}
            deliveryAvailabilityValues={pincodeOptions.deliveryAvailabilityValues}
            intent="shippingRename:create"
            mappings={mappings}
            pincodeOptions={pincodeOptions.pincodes}
            title="When..."
            type="rename"
          />

          <section className="bsure-actions-card">
            <div className="bsure-actions">
              <a className="bsure-button secondary" href="/app/shipping-mappings">Manage method mappings</a>
              <a className="bsure-button secondary" href="/app/pincodes">View imported pincodes</a>
              <a className="bsure-button" href="/app/publish">Publish config</a>
            </div>
          </section>

          <section className="bsure-card">
            <h2>Configured hide rules</h2>
            <RuleList items={hideRules} kind="shippingHide" mappings={mappings} />
          </section>

          <section className="bsure-card">
            <h2>Configured rename rules</h2>
            <RenameRuleList items={renameRules} mappings={mappings} />
          </section>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({
  areaGroups,
  cutoffs,
  deliveryAvailabilityValues,
  intent,
  mappings,
  pincodeOptions,
  title,
  type,
}: {
  areaGroups: string[];
  cutoffs: CutoffSetting[];
  deliveryAvailabilityValues: string[];
  intent: string;
  mappings: MethodMapping[];
  pincodeOptions: PincodeOption[];
  title: string;
  type: "hide" | "rename";
}) {
  return (
    <section className="bsure-card">
      <h2>{title}</h2>
      <p>Select the conditions here which will trigger the execution.</p>
      <Form method="post">
        <input name="intent" type="hidden" value={intent} />
        <div className="bsure-form-row">
          <Field label="Rule name">
            <input className="bsure-input" name="name" placeholder={type === "hide" ? "Hide rule label" : "Rename rule label"} />
          </Field>
          <Field label="Priority">
            <input className="bsure-input" defaultValue="100" name="priority" />
            <span className="bsure-help">Lower priority numbers run first.</span>
          </Field>
        </div>
        <div className="bsure-radio" style={{ marginTop: "16px" }}>
          <input aria-label="Enable rule" defaultChecked name="enabled" type="checkbox" />
          <span>
            <strong>Enabled</strong>
            <br />
            <span className="bsure-help">Include this rule in the next published config snapshot.</span>
          </span>
        </div>

        <div className="bsure-condition">
          <ConditionSelect label="Zip code / Postal code" operator="Has any of these values" />
          <PincodeChipSelector options={pincodeOptions} />
        </div>

        <div className="bsure-connector">And</div>

        <div className="bsure-condition">
          <ConditionSelect label="Shipping method" operator="Matches configured mapping" />
          <div className="bsure-form-row">
            <Field label="Shipping method mapping">
              <select className="bsure-select" name="shippingMethodMappingId">
                {mappings.map((mapping) => (
                  <option key={mapping.id} value={mapping.id}>{mapping.name}</option>
                ))}
              </select>
              <span className="bsure-help">Mappings are admin-configured. Shipping method names are not hardcoded.</span>
            </Field>
            <Field label="Cutoff setting">
              <select className="bsure-select" name="cutoffRuleSettingId">
                <option value="">No cutoff condition</option>
                {cutoffs.map((cutoff) => (
                  <option key={cutoff.id} value={cutoff.id}>{cutoff.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="bsure-connector">And</div>

        <div className="bsure-condition">
          <ConditionSelect label="Area / delivery data" operator="Has any of these values" />
          <div className="bsure-form-row">
            <Field label="Area groups from imported CSV">
              <select className="bsure-select" name="areaGroups">
                <option value="">Any area group</option>
                {areaGroups.map((areaGroup) => (
                  <option key={areaGroup} value={areaGroup}>{areaGroup}</option>
                ))}
              </select>
            </Field>
            <Field label="Delivery availability text">
              <select className="bsure-select" name="deliveryAvailabilityText">
                <option value="">Any delivery text</option>
                {deliveryAvailabilityValues.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {type === "rename" ? (
          <>
            <div className="bsure-connector">Then</div>
            <div className="bsure-condition">
              <ConditionSelect label="Rename action" operator="Set shipping method label" />
              <Field label="New shipping label">
                <input className="bsure-input" name="newLabel" placeholder="SHIPPING_LABEL_PLACEHOLDER" />
                <span className="bsure-help">Label must come from admin/imported configuration.</span>
              </Field>
            </div>
          </>
        ) : null}

        <div className="bsure-condition">
          <ConditionSelect label="Future-ready product condition" operator="Optional" />
          <Field label="Product tags">
            <input className="bsure-input" name="productTags" placeholder="PRODUCT_TAG_PLACEHOLDER" />
            <span className="bsure-help">Delivery Function currently no-ops if product tag conditions are active.</span>
          </Field>
          <Field label="Notes">
            <textarea className="bsure-textarea" name="notes" placeholder="Internal note" />
          </Field>
        </div>

        <div className="bsure-actions" style={{ marginTop: "18px" }}>
          <button className="bsure-button" type="submit">{type === "hide" ? "Save hide rule" : "Save rename rule"}</button>
        </div>
      </Form>
    </section>
  );
}

function ConditionSelect({ label, operator }: { label: string; operator: string }) {
  return (
    <div className="bsure-condition-grid">
      <select className="bsure-select" disabled>
        <option>{label}</option>
      </select>
      <select className="bsure-select" disabled>
        <option>{operator}</option>
      </select>
      <button className="bsure-button secondary" disabled type="button">⌫</button>
    </div>
  );
}

function PincodeChipSelector({ options }: { options: PincodeOption[] }) {
  const topOptions = options.slice(0, 400);
  return (
    <div>
      <div className="bsure-chip-box">
        <div className="bsure-chip-list">
          {topOptions.length ? (
            topOptions.map((option) => (
              <label className="bsure-chip" key={option.id} title={`${option.locationName} ${option.district} ${option.areaGroup}`}>
                <input name="pincodes" type="checkbox" value={option.pincode} />
                <span>{option.pincode}</span>
              </label>
            ))
          ) : (
            <span className="bsure-help">Approve a CSV import first. Active pincodes will appear here automatically.</span>
          )}
        </div>
      </div>
      <div className="bsure-chip-meta">
        <span>Bulk-select uploaded CSV pincodes for this rule.</span>
        <span>Total: {options.length}</span>
      </div>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="bsure-field">
      <span className="bsure-label">{label}</span>
      {children}
    </div>
  );
}

function RuleList({ items, kind, mappings }: { items: ShippingRule[]; kind: string; mappings: MethodMapping[] }) {
  if (!items.length) {
    return <p className="bsure-help">No hide rules created yet.</p>;
  }

  return (
    <div className="bsure-rule-list">
      {items.map((item) => (
        <RuleItem
          enabled={item.enabled}
          id={item.id}
          key={item.id}
          kind={kind}
          meta={`Priority ${item.priority} | Mapping: ${mappingName(mappings, item.shippingMethodMappingId)} | Pincodes: ${parseJsonList(item.pincodesJson).length}`}
          title={item.name}
        />
      ))}
    </div>
  );
}

function RenameRuleList({ items, mappings }: { items: ShippingRenameRule[]; mappings: MethodMapping[] }) {
  if (!items.length) {
    return <p className="bsure-help">No rename rules created yet.</p>;
  }

  return (
    <div className="bsure-rule-list">
      {items.map((item) => (
        <RuleItem
          enabled={item.enabled}
          id={item.id}
          key={item.id}
          kind="shippingRename"
          meta={`Priority ${item.priority} | Mapping: ${mappingName(mappings, item.shippingMethodMappingId)} | New label: ${item.newLabel || "Not set"}`}
          title={item.name}
        />
      ))}
    </div>
  );
}

function RuleItem({ enabled, id, kind, meta, title }: { enabled: boolean; id: string; kind: string; meta: string; title: string }) {
  return (
    <article className="bsure-rule-item">
      <div className="bsure-rule-item-top">
        <div>
          <h3>{title}</h3>
          <span className={enabled ? "bsure-pill active" : "bsure-pill disabled"}>{enabled ? "Active" : "Deactivated"}</span>
          <div className="bsure-rule-meta">{meta}</div>
        </div>
        <Form className="bsure-actions" method="post">
          <input name="id" type="hidden" value={id} />
          <button className="bsure-button secondary" name="intent" type="submit" value={`${kind}:toggle`}>Toggle</button>
          <button className="bsure-button danger" name="intent" type="submit" value={`${kind}:delete`}>Delete</button>
        </Form>
      </div>
    </article>
  );
}

function mappingName(mappings: MethodMapping[], id: string) {
  return mappings.find((mapping) => mapping.id === id)?.name || "Unmapped";
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
