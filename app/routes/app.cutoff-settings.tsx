import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";

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
  return <s-page heading="Cutoff settings"><s-section heading="Create cutoff setting"><Form method="post"><input type="hidden" name="intent" value="cutoff:create" /><div style={{ display: "grid", gap: "0.75rem", maxWidth: "42rem" }}><Text name="name" label="Setting name" /><Text name="priority" label="Priority" defaultValue="100" /><label><input name="enabled" type="checkbox" defaultChecked /> Enabled</label><Text name="timeValue" label="Time value" /><Text name="timezone" label="Timezone" /><label><strong>Match mode</strong><select name="matchMode" defaultValue="before"><option value="before">Before</option><option value="after">After</option><option value="equal">Equal</option></select></label><Text name="notes" label="Notes" /><button type="submit">Create setting</button></div></Form></s-section><s-section heading="Cutoff settings"><div style={{ display: "grid", gap: "0.75rem" }}>{settings.map((item) => <div key={item.id} style={{ border: "1px solid #d8ddd2", borderRadius: "8px", padding: "0.75rem" }}><strong>{item.name}</strong><p>Priority {item.priority} | {item.enabled ? "Enabled" : "Disabled"} | {item.matchMode} {item.timeValue} {item.timezone}</p><p>{item.notes}</p><Form method="post"><input type="hidden" name="id" value={item.id} /><button name="intent" value="cutoff:toggle" type="submit">Toggle</button>{" "}<button name="intent" value="cutoff:delete" type="submit">Delete</button></Form></div>)}</div></s-section></s-page>;
}

function Text({ defaultValue = "", label, name }: { defaultValue?: string; label: string; name: string }) {
  return <label style={{ display: "grid", gap: "0.3rem" }}><strong>{label}</strong><input defaultValue={defaultValue} name={name} style={{ padding: "0.5rem" }} /></label>;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
