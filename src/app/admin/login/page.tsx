import { redirect } from "next/navigation";
import { setAdminCookie, isAdmin } from "@/lib/admin/guard";
import { LogoLockup } from "@/components/brand/logo";

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
    <div className="flex min-h-dvh items-center justify-center bg-[--color-cream] px-5 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex justify-center">
          <LogoLockup size={36} />
        </div>
        <div className="rounded-3xl bg-white p-8 shadow-[0_8px_24px_-8px_rgba(74,44,53,0.08)]">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[--color-plum]">
              Модераторская
            </h1>
            <p className="mt-2 text-sm text-[--color-ink-2]">
              Закрытая зона. Введите ключ, чтобы продолжить.
            </p>
          </div>
          <form action={login} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
                Ключ доступа
              </span>
              <input
                name="secret"
                type="password"
                autoFocus
                placeholder="••••••••••••"
                className="h-12 rounded-2xl border border-[--color-line] bg-[--color-blush-soft] px-4 text-base text-[--color-plum] placeholder:text-[--color-ink-muted]"
                required
              />
            </label>
            {error ? (
              <p className="rounded-xl bg-[--color-danger-bg] px-3 py-2 text-center text-sm text-[--color-danger]">
                Неверный ключ. Проверьте и попробуйте снова.
              </p>
            ) : null}
            <button
              type="submit"
              className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(255,111,145,0.55)] transition active:scale-[.98]"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              Войти
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-xs text-[--color-ink-muted]">
          Только для команды модерации Bakhtlilar
        </p>
      </div>
    </div>
  );
}
