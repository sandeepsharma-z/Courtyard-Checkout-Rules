import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { requireAdminAuth } from "../../services/admin-auth.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (isShopifyAdminRequest(request, url)) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  await requireAdminAuth(request);

  return { showForm: Boolean(login) };
};

function isShopifyAdminRequest(request: Request, url: URL) {
  const referrer = request.headers.get("referer") ?? "";
  const fetchDest = request.headers.get("sec-fetch-dest") ?? "";

  return Boolean(
    url.searchParams.get("shop") ||
      url.searchParams.get("host") ||
      url.searchParams.get("embedded") ||
      fetchDest === "iframe" ||
      referrer.includes("admin.shopify.com"),
  );
}

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.gridBackdrop} />
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <span className={styles.brandMark}>C</span>
            <span>Courtyard Checkout Rules</span>
          </div>
          <span className={styles.phaseBadge}>Phase 2 shell</span>
        </header>

        <main className={styles.hero}>
          <section className={styles.copy}>
            <p className={styles.kicker}>Courtyard Farms</p>
            <h1 className={styles.heading}>Checkout controls for local delivery rules.</h1>
            <p className={styles.text}>
              Manage pincode delivery data, product restrictions, shipping
              options, payment rules, and validation workflows from configurable
              Shopify admin screens.
            </p>
            <div className={styles.badges} aria-label="Project safeguards">
              <span>No hardcoded values</span>
              <span>CSV-ready</span>
              <span>Shopify config first</span>
            </div>
          </section>

          <aside className={styles.panel} aria-label="Local app login">
            <div className={styles.panelHeader}>
              <span className={styles.statusDot} />
              <span>Phase 2 app shell</span>
            </div>
            <h2>Open the admin preview</h2>
            <p>
              Use a development store domain to start the Shopify login flow.
            </p>
            {showForm && (
              <Form className={styles.form} method="post" action="/auth/login">
                <label className={styles.label}>
                  <span>Shop domain</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="shop"
                    placeholder="your-store.myshopify.com"
                  />
                </label>
                <button className={styles.button} type="submit">
                  Log in
                </button>
              </Form>
            )}
          </aside>
        </main>

        <section className={styles.preview} aria-label="Configuration preview">
          <div>
            <span className={styles.previewLabel}>Configuration path</span>
            <strong>Imported data &gt; Admin review &gt; Shopify config</strong>
          </div>
          <p>
            Real charges, pincodes, cutoff times, tags, method names, and labels
            will come from imports or admin configuration only.
          </p>
        </section>

        <section className={styles.pipeline} aria-label="Checkout rules pipeline">
          <article>
            <span>01</span>
            <strong>Import</strong>
            <p>Review delivery rows before publishing configuration.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Configure</strong>
            <p>Manage pincode groups, tags, methods, labels, and messages.</p>
          </article>
          <article>
            <span>03</span>
            <strong>Simulate</strong>
            <p>Test checkout scenarios before enabling live behavior.</p>
          </article>
          <article>
            <span>04</span>
            <strong>Publish</strong>
            <p>Prepare Shopify metafields or metaobjects for future Functions.</p>
          </article>
        </section>
      </div>
    </div>
  );
}
