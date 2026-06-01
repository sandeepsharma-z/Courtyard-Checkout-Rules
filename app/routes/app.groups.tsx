import type { CSSProperties } from "react";
import { useActionToast } from "../components/Toast";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  createPincodeGroup,
  deletePincodeGroup,
  listPincodeGroups,
  updatePincodeGroup,
} from "../services/pincode-group-storage.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const groups = await listPincodeGroups();
  return {
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      notes: g.notes,
      pincodes: (() => {
        try {
          return (JSON.parse(g.pincodesJson) as string[]).join(", ");
        } catch {
          return "";
        }
      })(),
      count: (() => {
        try {
          return (JSON.parse(g.pincodesJson) as string[]).length;
        } catch {
          return 0;
        }
      })(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const id = String(formData.get("id") ?? "");
  const input = {
    name: String(formData.get("name") ?? ""),
    pincodes: String(formData.get("pincodes") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  if (intent === "create") await createPincodeGroup(input);
  else if (intent === "update" && id) await updatePincodeGroup(id, input);
  else if (intent === "delete" && id) await deletePincodeGroup(id);

  return { saved: true };
};

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #e3e3e3",
  borderRadius: "12px",
  padding: "18px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  marginBottom: "16px",
};
const input: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #c9cccf",
  borderRadius: "8px",
  fontSize: "14px",
  boxSizing: "border-box",
};
const btn: CSSProperties = {
  background: "#1a7a4a",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "9px 18px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

export default function GroupsPage() {
  const { groups } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  useActionToast(
    actionData ? { status: "success", message: "Group saved." } : undefined,
  );

  return (
    <div className="bsure-page">
      <div className="bsure-shell">
        <div className="bsure-topbar">
          <div className="bsure-title">
            <h1>Pincode groups</h1>
          </div>
          <Link className="bsure-button secondary" to="/app">
            Back
          </Link>
        </div>

        <p style={{ color: "#6d7175", fontSize: "13px", margin: "6px 0 16px" }}>
          Make reusable groups of pincodes. In a shipping or product rule, pick a
          group instead of pasting pincodes. Editing a group updates every rule
          that uses it. Pincodes may include prefixes like <b>400*</b> (= all
          Mumbai) to keep the list short.
        </p>

        {/* Create */}
        <section style={card}>
          <h2 style={{ margin: "0 0 12px", fontSize: "15px" }}>New group</h2>
          <Form method="post" style={{ display: "grid", gap: "10px" }}>
            <input type="hidden" name="intent" value="create" />
            <input style={input} name="name" placeholder="Group name (e.g. Mumbai zone)" required />
            <textarea
              style={{ ...input, minHeight: "70px" }}
              name="pincodes"
              placeholder="Pincodes / prefixes, comma or space separated (e.g. 400*, 401*, 110001)"
            />
            <input style={input} name="notes" placeholder="Notes (optional)" />
            <div>
              <button type="submit" style={btn}>
                Add group
              </button>
            </div>
          </Form>
        </section>

        {/* List */}
        {groups.length === 0 ? (
          <p style={{ color: "#6d7175" }}>No groups yet.</p>
        ) : (
          groups.map((g) => (
            <section style={card} key={g.id}>
              <Form method="post" style={{ display: "grid", gap: "10px" }}>
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="id" value={g.id} />
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input style={{ ...input, fontWeight: 600 }} name="name" defaultValue={g.name} />
                  <span style={{ color: "#6d7175", fontSize: "13px", whiteSpace: "nowrap" }}>
                    {g.count} pincodes
                  </span>
                </div>
                <textarea style={{ ...input, minHeight: "70px" }} name="pincodes" defaultValue={g.pincodes} />
                <input style={input} name="notes" defaultValue={g.notes} placeholder="Notes" />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="submit" style={btn}>
                    Save changes
                  </button>
                </div>
              </Form>
              <Form method="post" style={{ marginTop: "8px" }}>
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={g.id} />
                <button
                  type="submit"
                  style={{
                    background: "#fff",
                    color: "#d72c0d",
                    border: "1px solid #d72c0d",
                    borderRadius: "8px",
                    padding: "7px 14px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Delete group
                </button>
              </Form>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (
  headersArgs: Parameters<HeadersFunction>[0],
) => boundary.headers(headersArgs);
