import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const res = await admin.graphql(
    `#graphql
    query DebugPublishedConfig {
      shop {
        metafield(namespace: "courtyard_checkout_rules", key: "published_config") {
          value
          updatedAt
        }
      }
    }`,
  );
  const json = await res.json();
  const value: string | null = json?.data?.shop?.metafield?.value ?? null;
  const updatedAt: string | null = json?.data?.shop?.metafield?.updatedAt ?? null;

  let summary: Record<string, unknown> = { present: false };
  if (value) {
    try {
      const p = JSON.parse(value);
      const hides = p?.rules?.shippingHideRules ?? [];
      const renames = p?.rules?.shippingRenameRules ?? [];
      summary = {
        present: true,
        bytes: value.length,
        v: p?.v,
        kind: p?.kind,
        hasPincodeDataRecords: Array.isArray(p?.pincodeData?.records),
        ruleKeys: Object.keys(p?.rules ?? {}),
        hideCount: hides.length,
        renameCount: renames.length,
        hideRules: hides.slice(0, 12).map((h: Record<string, unknown>) => ({
          name: h.name,
          methodMatchMode: h.methodMatchMode,
          methods: h.selectedShippingMethods,
          has110001: (Array.isArray(h.pincodes) ? h.pincodes : []).includes("110001"),
          pincodeCount: Array.isArray(h.pincodes) ? h.pincodes.length : 0,
        })),
        renameRules: renames.slice(0, 12).map((r: Record<string, unknown>) => ({
          name: r.name,
          methods: r.selectedShippingMethods,
          has110001: (Array.isArray(r.pincodes) ? r.pincodes : []).includes("110001"),
          pincodeCount: Array.isArray(r.pincodes) ? r.pincodes.length : 0,
        })),
      };
    } catch (e) {
      summary = { present: true, parseError: String(e), bytes: value.length };
    }
  }

  return { summary, updatedAt };
};

export default function DebugConfigPage() {
  const { summary, updatedAt } = useLoaderData<typeof loader>();
  return (
    <div style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>Published config (live metafield)</h1>
      <p>metafield updatedAt: {updatedAt ?? "—"}</p>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 16, borderRadius: 8 }}>
        {JSON.stringify(summary, null, 2)}
      </pre>
    </div>
  );
}

export const headers: HeadersFunction = (
  headersArgs: Parameters<HeadersFunction>[0],
) => boundary.headers(headersArgs);
