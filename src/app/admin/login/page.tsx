import { redirect } from "next/navigation";
import { setAdminCookie, isAdmin } from "@/lib/admin/guard";
import {
  isThrottled,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/admin/login-throttle";
import { Logo } from "@/components/brand/logo";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await isAdmin()) redirect("/admin/moderation");

  async function login(formData: FormData) {
    "use server";
    if (await isThrottled()) {
      redirect("/admin/login?error=throttled");
    }
    const secret = String(formData.get("secret") ?? "");
    const ok = await setAdminCookie(secret);
    if (!ok) {
      await recordLoginFailure();
      redirect("/admin/login?error=1");
    }
    await recordLoginSuccess();
    redirect("/admin/moderation");
  }

  return (
    <div className="admin-scope flex min-h-dvh items-center justify-center bg-[--admin-bg] px-5 py-12">
      <div className="w-full max-w-[380px]">
        {/* Logo lockup */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span style={{ color: "var(--admin-accent)" }}>
            <Logo size={36} />
          </span>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight text-[--admin-text]">
              Bakhtlilar
            </span>
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: "var(--admin-accent)" }}
            >
              Admin
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[--admin-border] bg-white p-6 shadow-[var(--admin-shadow-lg)]">
          <h1 className="text-lg font-semibold tracking-tight text-[--admin-text]">
            Вход в модераторскую
          </h1>
          <p className="mt-1 text-sm text-[--admin-text-2]">
            Введите ключ доступа для продолжения.
          </p>

          <form action={login} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[--admin-text-2]">
                Ключ доступа
              </span>
              <input
                name="secret"
                type="password"
                autoFocus
                placeholder="••••••••••••••••"
                className="h-10 rounded-lg border border-[--admin-border] bg-white px-3 text-sm text-[--admin-text] placeholder:text-[--admin-text-muted]"
                required
              />
            </label>

            {error === "throttled" ? (
              <div
                className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
                style={{
                  backgroundColor: "var(--admin-warn-bg)",
                  borderColor: "var(--admin-warn-border)",
                  color: "var(--admin-warn)",
                }}
              >
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v6M5.5 8.5l2.5 -2 2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>Слишком много попыток. Подождите 15 минут и попробуйте снова.</span>
              </div>
            ) : error ? (
              <div
                className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
                style={{
                  backgroundColor: "var(--admin-danger-bg)",
                  borderColor: "var(--admin-danger-border)",
                  color: "var(--admin-danger)",
                }}
              >
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>Неверный ключ. Проверьте и попробуйте снова.</span>
              </div>
            ) : null}

            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold text-white shadow-[var(--admin-shadow-sm)] transition hover:brightness-110 active:brightness-95"
              style={{ backgroundColor: "var(--admin-accent)" }}
            >
              Войти
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[--admin-text-muted]">
          Закрытая зона. Только команда модерации.
        </p>
      </div>
    </div>
  );
}
