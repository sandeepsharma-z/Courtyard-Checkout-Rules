import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  getRuleManagerData,
  handleRuleManagerAction,
} from "../services/rule-config-storage.server";

type CutoffSetting = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  timeValue: string;
  timezone: string;
  matchMode: string;
  notes: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { cutoffRuleSettings } = await getRuleManagerData();
  return { settings: cutoffRuleSettings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/cutoff-settings");
};

export default function CutoffSettingsPage() {
  const { settings } = useLoaderData<typeof loader>();

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <Link className="bsure-back" to="/app">
              ←
            </Link>
            <h1>Cutoff time settings</h1>
          </div>
          <Link className="bsure-more" to="/app/shipping-rules">
            Shipping rules
          </Link>
        </div>

        <div className="bsure-flow">
          <section className="bsure-card">
            <h2>Create cutoff setting</h2>
            <p>
              Define a time-based condition that shipping rules can reference.
              Cutoff times must come from admin configuration, not hardcoded
              logic.
            </p>
            <Form method="post" style={{ marginTop: "18px" }}>
              <input type="hidden" name="intent" value="cutoff:create" />
              <div className="bsure-form-row">
                <Field label="Setting name">
                  <input
                    className="bsure-input"
                    name="name"
                    placeholder="e.g. Same Day Cutoff"
                  />
                </Field>
                <Field label="Priority">
                  <input
                    className="bsure-input"
                    defaultValue="100"
                    name="priority"
                    type="number"
                  />
                  <span className="bsure-help">Lower number runs first.</span>
                </Field>
              </div>
              <div className="bsure-form-row" style={{ marginTop: "14px" }}>
                <Field label="Time value">
                  <input
                    className="bsure-input"
                    name="timeValue"
                    placeholder="e.g. 14:00"
                    type="time"
                  />
                  <span className="bsure-help">
                    24-hour format. Must come from admin config.
                  </span>
                </Field>
                <Field label="Timezone">
                  <input
                    className="bsure-input"
                    name="timezone"
                    placeholder="e.g. Asia/Kolkata"
                  />
                  <span className="bsure-help">IANA timezone identifier.</span>
                </Field>
              </div>
              <div className="bsure-form-row" style={{ marginTop: "14px" }}>
                <Field label="Match mode">
                  <select
                    className="bsure-select"
                    defaultValue="before"
                    name="matchMode"
                  >
                    <option value="before">Before cutoff time</option>
                    <option value="after">After cutoff time</option>
                    <option value="equal">Equal to cutoff time</option>
                  </select>
                  <span className="bsure-help">
                    Rule applies when current time matches this condition.
                  </span>
                </Field>
              </div>
              <div className="bsure-radio" style={{ marginTop: "16px" }}>
                <input
                  aria-label="Enable cutoff setting"
                  defaultChecked
                  name="enabled"
                  type="checkbox"
                />
                <span>
                  <strong>Enabled</strong>
                  <br />
                  <span className="bsure-help">
                    Only enabled cutoff settings appear in shipping rule
                    selectors.
                  </span>
                </span>
              </div>
              <Field label="Notes" style={{ marginTop: "14px" }}>
                <textarea
                  className="bsure-textarea"
                  name="notes"
                  placeholder="Internal notes about this cutoff condition"
                />
              </Field>
              <div className="bsure-actions" style={{ marginTop: "18px" }}>
                <button className="bsure-button" type="submit">
                  Create cutoff setting
                </button>
              </div>
            </Form>
          </section>

          <section className="bsure-card">
            <h2>Configured cutoff settings ({settings.length})</h2>
            {settings.length === 0 ? (
              <p className="bsure-help" style={{ marginTop: "12px" }}>
                No cutoff settings yet. Create one above to reference in
                shipping rules.
              </p>
            ) : (
              <div className="bsure-rule-list" style={{ marginTop: "12px" }}>
                {settings.map((item) => (
                  <CutoffItem item={item} key={item.id} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function CutoffItem({ item }: { item: CutoffSetting }) {
  const [isEditing, setIsEditing] = useState(false);

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
          <div className="bsure-rule-meta" style={{ marginTop: "6px" }}>
            Priority {item.priority} &nbsp;·&nbsp; {item.matchMode}{" "}
            {item.timeValue} {item.timezone && `(${item.timezone})`}
          </div>
          {item.notes && <div className="bsure-rule-meta">{item.notes}</div>}
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
              value="cutoff:toggle"
            >
              Toggle
            </button>
            <button
              className="bsure-button danger"
              name="intent"
              type="submit"
              value="cutoff:delete"
            >
              Delete
            </button>
          </Form>
        </div>
      </div>
      {isEditing && (
        <Form className="bsure-edit-form" method="post">
          <input name="id" type="hidden" value={item.id} />
          <input name="intent" type="hidden" value="cutoff:update" />
          <div className="bsure-form-row">
            <Field label="Setting name">
              <input
                className="bsure-input"
                defaultValue={item.name}
                name="name"
              />
            </Field>
            <Field label="Priority">
              <input
                className="bsure-input"
                defaultValue={item.priority}
                name="priority"
                type="number"
              />
            </Field>
          </div>
          <div className="bsure-form-row" style={{ marginTop: "10px" }}>
            <Field label="Time value">
              <input
                className="bsure-input"
                defaultValue={item.timeValue}
                name="timeValue"
                type="time"
              />
            </Field>
            <Field label="Timezone">
              <input
                className="bsure-input"
                defaultValue={item.timezone}
                name="timezone"
              />
            </Field>
          </div>
          <div className="bsure-form-row" style={{ marginTop: "10px" }}>
            <Field label="Match mode">
              <select
                className="bsure-select"
                defaultValue={item.matchMode}
                name="matchMode"
              >
                <option value="before">Before cutoff time</option>
                <option value="after">After cutoff time</option>
                <option value="equal">Equal to cutoff time</option>
              </select>
            </Field>
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
          <Field label="Notes" style={{ marginTop: "10px" }}>
            <textarea
              className="bsure-textarea"
              defaultValue={item.notes}
              name="notes"
            />
          </Field>
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

function Field({
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

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
