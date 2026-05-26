import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";

type Mapping = { id: string; name: string; enabled: boolean; priority: number; matchType: string; matchValue: string; notes: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { shippingMethodMappings } = await getRuleManagerData();
  return { mappings: shippingMethodMappings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/shipping-mappings");
};

export default function ShippingMappingsPage() {
  const { mappings } = useLoaderData<typeof loader>();

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <a className="bsure-back" href="/app">←</a>
            <h1>Shipping method mappings</h1>
          </div>
          <a className="bsure-more" href="/app/shipping-rules">Shipping rules</a>
        </div>

        <div className="bsure-flow">
          <section className="bsure-card">
            <h2>Create mapping</h2>
            <p>Map a Shopify shipping method name so it can be used in hide and rename rules. Method names are never hardcoded.</p>
            <Form method="post" style={{ marginTop: "18px" }}>
              <input type="hidden" name="intent" value="shippingMapping:create" />
              <div className="bsure-form-row">
                <Field label="Admin label">
                  <input className="bsure-input" name="name" placeholder="e.g. Standard delivery" />
                </Field>
                <Field label="Priority">
                  <input className="bsure-input" defaultValue="100" name="priority" type="number" />
                  <span className="bsure-help">Lower number runs first.</span>
                </Field>
              </div>
              <div className="bsure-form-row" style={{ marginTop: "14px" }}>
                <Field label="Match type">
                  <select className="bsure-select" name="matchType" defaultValue="exact">
                    <option value="exact">Exact match</option>
                    <option value="contains">Contains</option>
                  </select>
                  <span className="bsure-help">Exact checks full name equality. Contains checks substring.</span>
                </Field>
                <Field label="Match value">
                  <input className="bsure-input" name="matchValue" placeholder="Shopify method title as shown at checkout" />
                  <span className="bsure-help">Must come from Shopify admin shipping settings, not hardcoded.</span>
                </Field>
              </div>
              <div className="bsure-radio" style={{ marginTop: "16px" }}>
                <input aria-label="Enable mapping" defaultChecked name="enabled" type="checkbox" />
                <span>
                  <strong>Enabled</strong>
                  <br />
                  <span className="bsure-help">Only enabled mappings appear in rule selectors.</span>
                </span>
              </div>
              <Field label="Notes" style={{ marginTop: "14px" }}>
                <textarea className="bsure-textarea" name="notes" placeholder="Internal notes" />
              </Field>
              <div className="bsure-actions" style={{ marginTop: "18px" }}>
                <button className="bsure-button" type="submit">Create mapping</button>
              </div>
            </Form>
          </section>

          <section className="bsure-card">
            <h2>Configured mappings ({mappings.length})</h2>
            {mappings.length === 0 ? (
              <p className="bsure-help" style={{ marginTop: "12px" }}>No mappings yet. Create one above to use in shipping rules.</p>
            ) : (
              <div className="bsure-rule-list" style={{ marginTop: "12px" }}>
                {mappings.map((item) => (
                  <MappingItem item={item} key={item.id} kind="shippingMapping" />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function MappingItem({ item, kind }: { item: Mapping; kind: string }) {
  return (
    <article className="bsure-rule-item">
      <div className="bsure-rule-item-top">
        <div>
          <h3>{item.name}</h3>
          <span className={item.enabled ? "bsure-pill active" : "bsure-pill disabled"}>
            {item.enabled ? "Active" : "Deactivated"}
          </span>
          <div className="bsure-rule-meta" style={{ marginTop: "6px" }}>
            Priority {item.priority} &nbsp;·&nbsp; {item.matchType === "exact" ? "Exact" : "Contains"}: <strong>{item.matchValue || "—"}</strong>
          </div>
          {item.notes && <div className="bsure-rule-meta">{item.notes}</div>}
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

function Field({ children, label, style }: { children: React.ReactNode; label: string; style?: React.CSSProperties }) {
  return (
    <div className="bsure-field" style={style}>
      <span className="bsure-label">{label}</span>
      {children}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
