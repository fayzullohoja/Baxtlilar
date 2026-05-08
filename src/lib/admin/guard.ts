import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE = "bakht_admin";

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === secret;
}

/**
 * Use inside every admin server action. Server actions are POST endpoints
 * with stable IDs — once an action ID is leaked or a previously-admin user
 * loses access, replay attacks are possible without an in-action auth check.
 *
 * Throws via redirect("/admin/login") if the caller is not authenticated.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function setAdminCookie(secret: string): Promise<boolean> {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || secret !== expected) return false;
  const store = await cookies();
  store.set(ADMIN_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return true;
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
