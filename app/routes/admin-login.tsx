import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData } from "react-router";

import {
  createAdminSession,
  getAdminSession,
} from "../services/admin-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await getAdminSession(request);
  if (session.get("admin_authed")) throw redirect("/");
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const validEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const validPassword = process.env.ADMIN_PASSWORD ?? "";

  if (email !== validEmail || password !== validPassword) {
    return { error: "Invalid email or password." };
  }

  return createAdminSession("/");
};

export default function AdminLogin() {
  const data = useActionData<typeof action>();

  return (
    <div style={styles.page}>
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.brandMark}>C</span>
          <span style={styles.brandName}>Courtyard Checkout Rules</span>
        </div>

        <div style={styles.divider} />

        <div>
          <p style={styles.kicker}>Courtyard Farms · Admin</p>
          <h1 style={styles.heading}>Welcome back</h1>
          <p style={styles.sub}>Sign in to manage your checkout rules.</p>
        </div>

        <Form method="post" style={styles.form}>
          <label style={styles.label}>
            <span style={styles.labelText}>Email address</span>
            <input
              type="email"
              name="email"
              placeholder="admin@example.com"
              autoComplete="email"
              required
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>Password</span>
            <input
              type="password"
              name="password"
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
              style={styles.input}
            />
          </label>

          {data?.error && <p style={styles.error}>{data.error}</p>}

          <button type="submit" style={styles.button}>
            Sign in
          </button>
        </Form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    background:
      "radial-gradient(ellipse 80% 60% at 10% -10%, rgba(47,95,61,0.2), transparent), " +
      "radial-gradient(ellipse 60% 50% at 90% 110%, rgba(100,140,80,0.14), transparent), " +
      "linear-gradient(155deg, #f0ede3 0%, #eaf0e4 40%, #f5f0e8 70%, #eef2e8 100%)",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "1.5rem",
    boxSizing: "border-box",
  },
  orb1: {
    position: "absolute",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(62,110,78,0.18) 0%, transparent 70%)",
    filter: "blur(80px)",
    top: "-150px",
    left: "-150px",
    pointerEvents: "none",
    zIndex: 0,
  },
  orb2: {
    position: "absolute",
    width: "380px",
    height: "380px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(130,170,100,0.14) 0%, transparent 70%)",
    filter: "blur(80px)",
    bottom: "-100px",
    right: "-120px",
    pointerEvents: "none",
    zIndex: 0,
  },
  card: {
    position: "relative",
    zIndex: 1,
    background: "rgba(255,255,255,0.82)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.9)",
    borderRadius: "24px",
    boxShadow:
      "0 8px 32px rgba(30,60,40,0.1), 0 40px 100px rgba(30,60,40,0.1), inset 0 1px 0 rgba(255,255,255,0.9)",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "420px",
    display: "grid",
    gap: "1.4rem",
    boxSizing: "border-box",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.7rem",
  },
  brandMark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "2.2rem",
    height: "2.2rem",
    background: "linear-gradient(145deg, #2d6640, #1e4d2e)",
    borderRadius: "10px",
    color: "#fff",
    fontWeight: 900,
    fontSize: "1rem",
    boxShadow: "0 2px 8px rgba(30,77,46,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
  },
  brandName: {
    fontWeight: 800,
    fontSize: "0.95rem",
    color: "#1a2e1c",
    letterSpacing: "-0.01em",
  },
  divider: {
    height: "1px",
    background:
      "linear-gradient(to right, transparent, rgba(49,73,55,0.15), transparent)",
  },
  kicker: {
    margin: "0 0 0.3rem",
    color: "#3d7549",
    fontSize: "0.72rem",
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  heading: {
    margin: "0 0 0.4rem",
    fontSize: "1.9rem",
    fontWeight: 900,
    letterSpacing: "-0.03em",
    color: "#0e2214",
    lineHeight: 1.1,
  },
  sub: {
    margin: 0,
    color: "#52645a",
    fontSize: "0.92rem",
    lineHeight: 1.5,
  },
  form: {
    display: "grid",
    gap: "1rem",
  },
  label: {
    display: "grid",
    gap: "0.45rem",
  },
  labelText: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#2a3e2d",
  },
  input: {
    background: "rgba(255,255,255,0.8)",
    border: "1.5px solid #c8d4c0",
    borderRadius: "10px",
    boxSizing: "border-box" as const,
    color: "#1a2e1c",
    font: "inherit",
    fontSize: "0.95rem",
    padding: "0.72rem 0.9rem",
    width: "100%",
    outline: "none",
    transition: "border-color 180ms ease, box-shadow 180ms ease",
  },
  error: {
    margin: 0,
    padding: "0.6rem 0.9rem",
    background: "rgba(200,60,60,0.08)",
    border: "1px solid rgba(200,60,60,0.22)",
    borderRadius: "8px",
    color: "#c0392b",
    fontSize: "0.88rem",
    fontWeight: 600,
  },
  button: {
    background: "linear-gradient(145deg, #2f6640, #1e4d2e)",
    border: 0,
    borderRadius: "10px",
    boxShadow:
      "0 4px 16px rgba(30,77,46,0.3), inset 0 1px 0 rgba(255,255,255,0.12)",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: 700,
    letterSpacing: "0.01em",
    padding: "0.85rem 1rem",
    transition: "background 200ms ease, transform 200ms ease, box-shadow 200ms ease",
  },
};
