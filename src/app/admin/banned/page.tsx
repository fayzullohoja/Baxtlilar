import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transition } from "@/lib/state-machine/transitions";
import { AdminShell } from "@/components/admin/shell";

const PAGE_SIZE = 50;

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BannedListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const sp = await searchParams;
  const search = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let q = supabaseAdmin
    .from("users")
    .select(
      "id, telegram_id, telegram_username, telegram_first_name, phone_number, blocked_at, blocked_reason, verification_status",
      { count: "exact" },
    )
    .eq("lifecycle_state", "blocked");

  if (search) {
    const safe = search.replace(/[%,]/g, " ");
    if (/^\d+$/.test(safe)) {
      q = q.or(`telegram_id.eq.${safe},phone_number.ilike.%${safe}%`);
    } else {
      q = q.or(
        `telegram_first_name.ilike.%${safe}%,telegram_username.ilike.%${safe}%,phone_number.ilike.%${safe}%,blocked_reason.ilike.%${safe}%`,
      );
    }
  }

  const { data: rows, count } = await q
    .order("blocked_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const items = rows ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  async function unban(formData: FormData) {
    "use server";
    const userId = String(formData.get("user_id"));
    if (!userId) return;
    // Restore to onboarding/active depending on profile_completion (best-effort)
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("profile_completion, quiz_completion")
      .eq("id", userId)
      .maybeSingle();
    const restoreActive =
      u?.profile_completion === "completed" && u?.quiz_completion === "completed";
    await transition(
      userId,
      restoreActive
        ? {
            lifecycle_state: "active",
            verification_status: "approved",
            blocked_at: null,
            blocked_reason: null,
          }
        : {
            lifecycle_state: "onboarding",
            blocked_at: null,
            blocked_reason: null,
          },
      "moderator unbanned user",
      "admin",
    );
    redirect("/admin/banned");
  }

  function buildHref(opts: { q?: string; page?: number }) {
    const p = new URLSearchParams();
    const newSearch = opts.q ?? search;
    if (newSearch) p.set("q", newSearch);
    if (opts.page && opts.page > 1) p.set("page", String(opts.page));
    const qs = p.toString();
    return `/admin/banned${qs ? `?${qs}` : ""}`;
  }

  return (
    <AdminShell
      title="Заблокированные"
      subtitle="Юзеры с lifecycle_state = blocked. Можно разблокировать, если решение было ошибочным."
      onLogout={logout}
      activeNav="/admin/banned"
    >
      <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
        <div className="flex flex-col gap-3 border-b border-[--admin-border] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[--admin-text]">
              Список заблокированных
            </h2>
            <span
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: "var(--admin-danger-bg)",
                color: "var(--admin-danger)",
              }}
            >
              {totalCount}
            </span>
          </div>

          <form className="flex items-center gap-2" action="/admin/banned">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-2 h-4 w-4 text-[--admin-text-muted]"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
              >
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Имя · телефон · TG · причина"
                className="h-8 w-48 rounded-md border border-[--admin-border] bg-white pl-8 pr-2 text-sm text-[--admin-text] placeholder:text-[--admin-text-muted] sm:w-64"
              />
            </div>
            {search ? (
              <Link
                href={buildHref({ q: "", page: 1 })}
                className="text-xs text-[--admin-text-muted] hover:text-[--admin-text]"
              >
                ×
              </Link>
            ) : null}
          </form>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--admin-success-bg)",
                color: "var(--admin-success)",
              }}
              aria-hidden
            >
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 10.5l3.5 3.5L15 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-[--admin-text]">
              {search ? "Никого не нашли" : "Никто не заблокирован"}
            </h3>
            <p className="mt-1 text-sm text-[--admin-text-2]">
              {search
                ? "Попробуйте другой запрос"
                : "Будем держать кулачки, чтобы так и оставалось"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--admin-border] bg-[--admin-surface-2] text-left text-[11px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
                    <th className="px-5 py-2.5">Пользователь</th>
                    <th className="hidden px-5 py-2.5 sm:table-cell">Контакт</th>
                    <th className="px-5 py-2.5">Причина</th>
                    <th className="px-5 py-2.5 text-right">Заблокирован</th>
                    <th className="w-32 px-3 py-2.5 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => {
                    const initial = (u.telegram_first_name ?? "?")
                      .trim()
                      .slice(0, 1)
                      .toUpperCase();
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-[--admin-border] last:border-b-0"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/admin/moderation/${u.id}`}
                            className="flex items-center gap-3"
                          >
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                              style={{
                                backgroundColor: "var(--admin-danger-bg)",
                                color: "var(--admin-danger)",
                                border: "1px solid var(--admin-danger-border)",
                              }}
                            >
                              {initial}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[--admin-text]">
                                {u.telegram_first_name ?? "Без имени"}
                                {u.telegram_username ? (
                                  <span className="ml-1 text-xs font-normal text-[--admin-text-muted]">
                                    @{u.telegram_username}
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-xs text-[--admin-text-muted] sm:hidden">
                                {u.phone_number ?? "—"}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="hidden px-5 py-3 font-mono text-xs text-[--admin-text-2] sm:table-cell">
                          {u.phone_number ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <p className="max-w-md truncate text-sm text-[--admin-text-2]">
                            {u.blocked_reason ?? "—"}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-[--admin-text-2]">
                          {formatDateTime(u.blocked_at)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <form action={unban} className="inline-flex">
                            <input type="hidden" name="user_id" value={u.id} />
                            <button
                              type="submit"
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-[--admin-border] bg-white px-2.5 text-xs font-medium text-[--admin-text-2] transition hover:border-[--admin-success-border] hover:text-[--admin-success]"
                              title="Разблокировать"
                            >
                              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2.5 6L5 8.5l4.5-5"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              Unban
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-[--admin-border] bg-[--admin-surface-2] px-4 py-3 text-xs text-[--admin-text-2]">
                <p>
                  {offset + 1}–{Math.min(offset + items.length, totalCount)} из{" "}
                  <span className="font-semibold text-[--admin-text]">
                    {totalCount}
                  </span>
                </p>
                <div className="flex items-center gap-1.5">
                  {page > 1 ? (
                    <Link
                      href={buildHref({ page: page - 1 })}
                      className="inline-flex h-7 items-center rounded-md border border-[--admin-border] bg-white px-2.5 font-medium text-[--admin-text-2] hover:text-[--admin-text]"
                    >
                      ← Назад
                    </Link>
                  ) : null}
                  <span className="px-1">
                    стр. {page} из {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={buildHref({ page: page + 1 })}
                      className="inline-flex h-7 items-center rounded-md border border-[--admin-border] bg-white px-2.5 font-medium text-[--admin-text-2] hover:text-[--admin-text]"
                    >
                      Дальше →
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </AdminShell>
  );
}
