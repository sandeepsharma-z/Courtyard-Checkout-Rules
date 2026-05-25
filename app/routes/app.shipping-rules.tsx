import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const data = await getRuleManagerData();
  return { hideRules: data.shippingHideRules, renameRules: data.shippingRenameRules, mappings: data.shippingMethodMappings, cutoffs: data.cutoffRuleSettings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/shipping-rules");
};

export default function ShippingRulesPage() {
  const { cutoffs, hideRules, mappings, renameRules } = useLoaderData<typeof loader>();
  return <s-page heading="Shipping rules"><s-section heading="Create hide rule"><RuleForm intent="shippingHide:create" mappings={mappings} cutoffs={cutoffs} /></s-section><s-section heading="Create rename rule"><RuleForm intent="shippingRename:create" mappings={mappings} cutoffs={cutoffs} rename /></s-section><s-section heading="Hide rules"><List items={hideRules} kind="shippingHide" extra={(item) => `Mapping ${item.shippingMethodMappingId}`} /></s-section><s-section heading="Rename rules"><List items={renameRules} kind="shippingRename" extra={(item) => `Mapping ${item.shippingMethodMappingId} | New label ${item.newLabel}`} /></s-section></s-page>;
}

function RuleForm({ cutoffs, intent, mappings, rename = false }: { cutoffs: Array<{ id: string; name: string }>; intent: string; mappings: Array<{ id: string; name: string }>; rename?: boolean }) {
  return <Form method="post"><input type="hidden" name="intent" value={intent} /><div style={{ display: "grid", gap: "0.75rem", maxWidth: "48rem" }}><Text name="name" label="Rule name" /><Text name="priority" label="Priority" defaultValue="100" /><label><input name="enabled" type="checkbox" defaultChecked /> Enabled</label><Select name="shippingMethodMappingId" label="Shipping method mapping" items={mappings} /><Select name="cutoffRuleSettingId" label="Cutoff setting" items={cutoffs} optional />{rename && <Text name="newLabel" label="New shipping label" />}<Text name="productTags" label="Product tags (comma-separated)" /><Text name="pincodes" label="Pincodes (comma-separated)" /><Text name="areaGroups" label="Area groups (comma-separated)" /><Text name="deliveryAvailabilityText" label="Delivery availability text" /><Text name="notes" label="Notes" /><button type="submit">Create rule</button></div></Form>;
}

function Text({ defaultValue = "", label, name }: { defaultValue?: string; label: string; name: string }) {
  return <label style={{ display: "grid", gap: "0.3rem" }}><strong>{label}</strong><input defaultValue={defaultValue} name={name} style={{ padding: "0.5rem" }} /></label>;
}

function Select({ items, label, name, optional = false }: { items: Array<{ id: string; name: string }>; label: string; name: string; optional?: boolean }) {
  return <label style={{ display: "grid", gap: "0.3rem" }}><strong>{label}</strong><select name={name}>{optional && <option value="">None</option>}{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

function List<T extends { id: string; name: string; enabled: boolean; priority: number; notes: string }>({ extra, items, kind }: { extra: (item: T) => string; items: T[]; kind: string }) {
  return <div style={{ display: "grid", gap: "0.75rem" }}>{items.map((item) => <div key={item.id} style={{ border: "1px solid #d8ddd2", borderRadius: "8px", padding: "0.75rem" }}><strong>{item.name}</strong><p>Priority {item.priority} | {item.enabled ? "Enabled" : "Disabled"} | {extra(item)}</p><p>{item.notes}</p><Form method="post"><input type="hidden" name="id" value={item.id} /><button name="intent" value={`${kind}:toggle`} type="submit">Toggle</button>{" "}<button name="intent" value={`${kind}:delete`} type="submit">Delete</button></Form></div>)}</div>;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
