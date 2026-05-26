import { createCookieSessionStorage, redirect } from "react-router";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__courtyard_admin",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET ?? "courtyard-dev-secret-change-in-prod"],
    maxAge: 60 * 60 * 8,
  },
});

export async function requireAdminAuth(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie"),
  );
  if (!session.get("admin_authed")) {
    throw redirect("/admin-login");
  }
}

export async function createAdminSession(redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("admin_authed", true);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export async function getAdminSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export { sessionStorage };
