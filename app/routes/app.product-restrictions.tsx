import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { productRestrictionRules } = await getRuleManagerData();
  return { rules: productRestrictionRules };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/product-restrictions");
};

export default function ProductRestrictionsPage() {
  const { rules } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Product restriction rules">
      <s-section heading="Create rule">
        <RuleForm intent="productRestriction:create" fields={["productTags", "pincodes", "areaGroups", "deliveryAvailabilityText", "validationMessage"]} />
      </s-section>
      <s-section heading="Configured rules">
        <RuleList items={rules} kind="productRestriction" extra={(rule) => `Tags ${rule.productTagsJson} | Message ${rule.validationMessage}`} />
      </s-section>
    </s-page>
  );
}

function RuleForm({ fields, intent }: { fields: string[]; intent: string }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <div style={{ display: "grid", gap: "0.75rem", maxWidth: "48rem" }}>
        <Text name="name" label="Rule name" />
        <Text name="priority" label="Priority" defaultValue="100" />
        <label><input name="enabled" type="checkbox" defaultChecked /> Enabled</label>
        {fields.includes("productTags") && <Text name="productTags" label="Product tags (comma-separated)" />}
        {fields.includes("pincodes") && <Text name="pincodes" label="Pincodes (comma-separated)" />}
        {fields.includes("areaGroups") && <Text name="areaGroups" label="Area groups (comma-separated)" />}
        {fields.includes("deliveryAvailabilityText") && <Text name="deliveryAvailabilityText" label="Delivery availability text" />}
        {fields.includes("validationMessage") && <Text name="validationMessage" label="Validation message" />}
        <Text name="notes" label="Notes" />
        <button type="submit">Create rule</button>
      </div>
    </Form>
  );
}

function Text({ defaultValue = "", label, name }: { defaultValue?: string; label: string; name: string }) {
  return <label style={{ display: "grid", gap: "0.3rem" }}><strong>{label}</strong><input defaultValue={defaultValue} name={name} style={{ padding: "0.5rem" }} /></label>;
}

function RuleList<T extends { id: string; name: string; enabled: boolean; priority: number; notes: string }>({ extra, items, kind }: { extra: (item: T) => string; items: T[]; kind: string }) {
  return <div style={{ display: "grid", gap: "0.75rem" }}>{items.map((item) => <div key={item.id} style={{ border: "1px solid #d8ddd2", borderRadius: "8px", padding: "0.75rem" }}><strong>{item.name}</strong><p>Priority {item.priority} | {item.enabled ? "Enabled" : "Disabled"}</p><p>{extra(item)}</p><p>{item.notes}</p><Form method="post"><input type="hidden" name="id" value={item.id} /><button name="intent" value={`${kind}:toggle`} type="submit">Toggle</button>{" "}<button name="intent" value={`${kind}:delete`} type="submit">Delete</button></Form></div>)}</div>;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
