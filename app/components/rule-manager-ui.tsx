import type { ReactNode } from "react";
import { Form } from "react-router";

type Option = {
  id: string;
  name: string;
};

export function RuleManagerLayout({
  badges,
  children,
  description,
  metrics,
  side,
  title,
}: {
  badges: string[];
  children: ReactNode;
  description: string;
  metrics: Array<{ label: string; value: string | number }>;
  side: ReactNode;
  title: string;
}) {
  return (
    <div className="ccr-page">
      <div className="ccr-shell">
        <header className="ccr-hero">
          <div>
            <p className="ccr-eyebrow">Courtyard Checkout Rules</p>
            <h1>{title}</h1>
            <p>{description}</p>
            <div className="ccr-badges">
              {badges.map((badge) => (
                <span className="ccr-badge" key={badge}>
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <div className="ccr-metrics">
            {metrics.map((metric) => (
              <div className="ccr-metric" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </header>
        <div className="ccr-grid">
          <main className="ccr-stack">{children}</main>
          <aside className="ccr-side-note">{side}</aside>
        </div>
      </div>
    </div>
  );
}

export function RulePanel({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="ccr-card">
      <div className="ccr-card-header">
        <div>
          {eyebrow ? <p className="ccr-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export function TextField({
  defaultValue = "",
  help,
  label,
  name,
  placeholder = "",
  textarea = false,
}: {
  defaultValue?: string;
  help?: string;
  label: string;
  name: string;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div className="ccr-field">
      <label htmlFor={name}>{label}</label>
      {textarea ? (
        <textarea className="ccr-textarea" defaultValue={defaultValue} id={name} name={name} placeholder={placeholder} />
      ) : (
        <input className="ccr-input" defaultValue={defaultValue} id={name} name={name} placeholder={placeholder} />
      )}
      {help ? <p className="ccr-help">{help}</p> : null}
    </div>
  );
}

export function SelectField({
  help,
  label,
  name,
  optional = false,
  options,
}: {
  help?: string;
  label: string;
  name: string;
  optional?: boolean;
  options: Option[];
}) {
  return (
    <div className="ccr-field">
      <label htmlFor={name}>{label}</label>
      <select className="ccr-select" id={name} name={name}>
        {optional ? <option value="">No cutoff condition</option> : null}
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {help ? <p className="ccr-help">{help}</p> : null}
    </div>
  );
}

export function ToggleField({ defaultChecked = true, label }: { defaultChecked?: boolean; label: string }) {
  return (
    <label className="ccr-toggle">
      <input defaultChecked={defaultChecked} name="enabled" type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

export function ConditionBox({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="ccr-condition-box">
      <div className="ccr-condition-title">
        <span className="ccr-dot" />
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

export function RuleActions({ label }: { label: string }) {
  return (
    <div className="ccr-actions">
      <button className="ccr-button" type="submit">
        {label}
      </button>
      <span className="ccr-help">Saved locally first. Publish config separately before checkout Functions can read it.</span>
    </div>
  );
}

export function ManagedForm({ children, intent }: { children: ReactNode; intent: string }) {
  return (
    <Form className="ccr-form" method="post">
      <input name="intent" type="hidden" value={intent} />
      {children}
    </Form>
  );
}

export function RuleCard({
  actionsKind,
  children,
  enabled,
  id,
  meta,
  notes,
  priority,
  title,
}: {
  actionsKind: string;
  children?: ReactNode;
  enabled: boolean;
  id: string;
  meta: string[];
  notes?: string;
  priority: number;
  title: string;
}) {
  return (
    <article className="ccr-rule-card">
      <div className="ccr-rule-top">
        <div className="ccr-rule-title">
          <h3>{title}</h3>
          <div className="ccr-rule-meta">
            <span className={enabled ? "ccr-status enabled" : "ccr-status disabled"}>{enabled ? "Enabled" : "Disabled"}</span>
            <span className="ccr-chip">Priority {priority}</span>
            {meta.map((item) => (
              <span className="ccr-chip" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
        <Form className="ccr-actions" method="post">
          <input name="id" type="hidden" value={id} />
          <button className="ccr-button secondary" name="intent" type="submit" value={`${actionsKind}:toggle`}>
            Toggle
          </button>
          <button className="ccr-button danger" name="intent" type="submit" value={`${actionsKind}:delete`}>
            Delete
          </button>
        </Form>
      </div>
      <div className="ccr-rule-details">
        {children}
        {notes ? <p className="ccr-help">{notes}</p> : null}
      </div>
    </article>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <div className="ccr-empty">{label}</div>;
}

export function ChipList({ items, label }: { items: string[]; label: string }) {
  return (
    <div>
      <p className="ccr-help">{label}</p>
      <div className="ccr-chip-row">
        {items.length ? items.map((item) => <span className="ccr-chip" key={item}>{item}</span>) : <span className="ccr-chip">Any</span>}
      </div>
    </div>
  );
}

export function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}
