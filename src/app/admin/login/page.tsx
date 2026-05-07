import { redirect } from "next/navigation";
import { setAdminCookie, isAdmin } from "@/lib/admin/guard";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await isAdmin()) redirect("/admin/moderation");

  async function login(formData: FormData) {
    "use server";
    const secret = String(formData.get("secret") ?? "");
    const ok = await setAdminCookie(secret);
    if (!ok) redirect("/admin/login?error=1");
    redirect("/admin/moderation");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-4 text-2xl font-semibold">Admin login</h1>
      <form action={login} className="flex flex-col gap-3">
        <input
          name="secret"
          type="password"
          autoFocus
          placeholder="ADMIN_SECRET"
          className="h-12 rounded-xl border border-neutral-300 bg-white px-4"
          required
        />
        {error ? (
          <p className="text-sm text-red-600">Неверный секрет</p>
        ) : null}
        <button
          type="submit"
          className="h-12 rounded-xl bg-neutral-900 font-medium text-white"
        >
          Войти
        </button>
      </form>
    </div>
  );
}
