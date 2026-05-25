import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { paymentMethodMappings } = await getRuleManagerData();
  return { mappings: paymentMethodMappings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/payment-mappings");
};

export default function PaymentMappingsPage() {
  const { mappings } = useLoaderData<typeof loader>();
  return <s-page heading="Payment method mappings"><s-section heading="Create mapping"><Form method="post"><input type="hidden" name="intent" value="paymentMapping:create" /><div style={{ display: "grid", gap: "0.75rem", maxWidth: "42rem" }}><Text name="name" label="Admin label" /><Text name="priority" label="Priority" defaultValue="100" /><label><input name="enabled" type="checkbox" defaultChecked /> Enabled</label><label><strong>Match type</strong><select name="matchType" defaultValue="exact"><option value="exact">Exact</option><option value="contains">Contains</option></select></label><Text name="matchValue" label="Match value" /><Text name="notes" label="Notes" /><button type="submit">Create mapping</button></div></Form></s-section><s-section heading="Mappings"><List items={mappings} kind="paymentMapping" /></s-section></s-page>;
}

function Text({ defaultValue = "", label, name }: { defaultValue?: string; label: string; name: string }) {
  return <label style={{ display: "grid", gap: "0.3rem" }}><strong>{label}</strong><input defaultValue={defaultValue} name={name} style={{ padding: "0.5rem" }} /></label>;
}

function List({ items, kind }: { items: Array<{ id: string; name: string; enabled: boolean; priority: number; matchType: string; matchValue: string; notes: string }>; kind: string }) {
  return <div style={{ display: "grid", gap: "0.75rem" }}>{items.map((item) => <div key={item.id} style={{ border: "1px solid #d8ddd2", borderRadius: "8px", padding: "0.75rem" }}><strong>{item.name}</strong><p>Priority {item.priority} | {item.enabled ? "Enabled" : "Disabled"} | {item.matchType}: {item.matchValue}</p><p>{item.notes}</p><Form method="post"><input type="hidden" name="id" value={item.id} /><button name="intent" value={`${kind}:toggle`} type="submit">Toggle</button>{" "}<button name="intent" value={`${kind}:delete`} type="submit">Delete</button></Form></div>)}</div>;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
