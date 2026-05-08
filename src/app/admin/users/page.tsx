import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie } from "@/lib/admin/guard";
import { LIFECYCLE_LABELS, VERIFICATION_LABELS } from "@/lib/admin/labels";
import { formatUzPhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell, StatusBadge } from "@/components/admin/shell";

const PAGE_SIZE = 50;

const LIFECYCLE_FILTERS = [
  { key: "all", label: "Все" },
  { key: "onboarding", label: "Онбординг" },
  { key: "active", label: "Активные" },
  { key: "paused", label: "На паузе" },
  { key: "blocked", label: "Заблокированы" },
  { key: "deleted", label: "Удалены" },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function UsersListPage({
  searchParams,
}: {
  searchParams: Promise<{
    lifecycle?: string;
    q?: string;
    page?: string;
    lang?: string;
  }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const sp = await searchParams;
  const lifecycle = sp.lifecycle ?? "all";
  const search = (sp.q ?? "").trim();
  const langFilter = sp.lang ?? "all"; // all | ru | uz
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Counts per lifecycle
  const { data: allRows } = await supabaseAdmin
    .from("users")
    .select("lifecycle_state");
  const lifecycleCounts = (allRows ?? []).reduce<Record<string, number>>(
    (acc, u) => {
      acc[u.lifecycle_state] = (acc[u.lifecycle_state] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const totalUsers = allRows?.length ?? 0;

  // Filtered query
  let q = supabaseAdmin
    .from("users")
    .select(
      "id, telegram_id, telegram_username, telegram_first_name, phone_number, language, lifecycle_state, verification_status, created_at, last_active_at",
      { count: "exact" },
    );

  if (lifecycle !== "all") {
    q = q.eq("lifecycle_state", lifecycle);
  }

  if (langFilter === "ru" || langFilter === "uz") {
    q = q.eq("language", langFilter);
  }

  if (search) {
    const safe = search.replace(/[%,]/g, " ");
    if (/^\d+$/.test(safe)) {
      q = q.or(`telegram_id.eq.${safe},phone_number.ilike.%${safe}%`);
    } else {
      q = q.or(
        `telegram_first_name.ilike.%${safe}%,telegram_username.ilike.%${safe}%,phone_number.ilike.%${safe}%`,
      );
    }
  }

  const { data: rows, count } = await q
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const items = rows ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Pre-sign main photo URLs for users that have one. Single batched query.
  const userIds = items.map((u) => u.id);
  const { data: photoRows } =
    userIds.length > 0
      ? await supabaseAdmin
          .from("profile_photos")
          .select("user_id, storage_path")
          .in("user_id", userIds)
          .eq("is_main", true)
      : { data: [] };
  const photoUrlByUser = new Map<string, string>();
  await Promise.all(
    (photoRows ?? []).map(async (r) => {
      const { data } = await supabaseAdmin.storage
        .from("profile-photos")
        .createSignedUrl(r.storage_path, 60 * 60);
      if (data?.signedUrl) photoUrlByUser.set(r.user_id, data.signedUrl);
    }),
  );

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  function buildHref(opts: {
    lifecycle?: string;
    q?: string;
    lang?: string;
    page?: number;
  }) {
    const p = new URLSearchParams();
    const newLife = opts.lifecycle ?? lifecycle;
    if (newLife !== "all") p.set("lifecycle", newLife);
    const newSearch = opts.q ?? search;
    if (newSearch) p.set("q", newSearch);
    const newLang = opts.lang ?? langFilter;
    if (newLang !== "all") p.set("lang", newLang);
    if (opts.page && opts.page > 1) p.set("page", String(opts.page));
    const qs = p.toString();
    return `/admin/users${qs ? `?${qs}` : ""}`;
  }

  return (
    <AdminShell
      title="Все пользователи"
      subtitle="Полный список с фильтрами по жизненному циклу. Кликните по строке, чтобы открыть карточку."
      onLogout={logout}
      activeNav="/admin/users"
    >
      {/* Filter tabs */}
      <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
        <div className="flex flex-col gap-3 border-b border-[--admin-border] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            className="inline-flex flex-wrap items-center gap-1 rounded-lg p-1"
            style={{ backgroundColor: "var(--admin-surface-2)" }}
          >
            {LIFECYCLE_FILTERS.map((f) => {
              const active = lifecycle === f.key;
              const cnt =
                f.key === "all" ? totalUsers : lifecycleCounts[f.key] ?? 0;
              return (
                <Link
                  key={f.key}
                  href={buildHref({ lifecycle: f.key, page: 1 })}
                  role="tab"
                  aria-selected={active}
                  className={
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition " +
                    (active
                      ? "bg-white text-[--admin-text] shadow-[var(--admin-shadow-sm)]"
                      : "text-[--admin-text-2] hover:text-[--admin-text]")
                  }
                >
                  {f.label}
                  <span
                    className="rounded-md px-1.5 text-[10px] font-semibold"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    {cnt}
                  </span>
                </Link>
              );
            })}
          </div>

          <div
            role="tablist"
            aria-label="lang"
            className="inline-flex items-center gap-1 rounded-lg p-1"
            style={{ backgroundColor: "var(--admin-surface-2)" }}
          >
            {[
              { key: "all", label: "Все" },
              { key: "ru", label: "RU" },
              { key: "uz", label: "UZ" },
            ].map((l) => {
              const active = langFilter === l.key;
              return (
                <Link
                  key={l.key}
                  href={buildHref({ lang: l.key, page: 1 })}
                  role="tab"
                  aria-selected={active}
                  className={
                    "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition " +
                    (active
                      ? "bg-white text-[--admin-text] shadow-[var(--admin-shadow-sm)]"
                      : "text-[--admin-text-2] hover:text-[--admin-text]")
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          <form className="flex items-center gap-2" action="/admin/users">
            {lifecycle !== "all" ? (
              <input type="hidden" name="lifecycle" value={lifecycle} />
            ) : null}
            {langFilter !== "all" ? (
              <input type="hidden" name="lang" value={langFilter} />
            ) : null}
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
                placeholder="Имя · телефон · TG ID"
                className="h-8 w-48 rounded-md border border-[--admin-border] bg-white pl-8 pr-2 text-sm text-[--admin-text] placeholder:text-[--admin-text-muted] sm:w-56"
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
            <p className="text-sm text-[--admin-text-2]">Никого не нашли</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--admin-border] bg-[--admin-surface-2] text-left text-[11px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
                    <th className="px-5 py-2.5">Пользователь</th>
                    <th className="hidden px-5 py-2.5 sm:table-cell">Контакт</th>
                    <th className="hidden px-5 py-2.5 md:table-cell">Telegram</th>
                    <th className="px-5 py-2.5">Lifecycle</th>
                    <th className="hidden px-5 py-2.5 lg:table-cell">Verification</th>
                    <th className="hidden px-5 py-2.5 text-right md:table-cell">Активен</th>
                    <th className="px-5 py-2.5 text-right">Создан</th>
                    <th className="w-12 px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => {
                    const initial = (u.telegram_first_name ?? "?")
                      .trim()
                      .slice(0, 1)
                      .toUpperCase();
                    const lifecycleBadge =
                      LIFECYCLE_LABELS[u.lifecycle_state] ?? {
                        label: u.lifecycle_state,
                        tone: "default" as const,
                      };
                    const verificationBadge =
                      VERIFICATION_LABELS[u.verification_status] ?? {
                        label: u.verification_status,
                        tone: "default" as const,
                      };
                    return (
                      <tr
                        key={u.id}
                        className="group border-b border-[--admin-border] last:border-b-0 transition hover:bg-[--admin-row-hover]"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/admin/moderation/${u.id}`}
                            className="flex items-center gap-3"
                          >
                            {photoUrlByUser.has(u.id) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photoUrlByUser.get(u.id)!}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded-full object-cover"
                                style={{ border: "1px solid var(--admin-border)" }}
                              />
                            ) : (
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                                style={{
                                  backgroundColor: "var(--admin-surface-2)",
                                  color: "var(--admin-text-2)",
                                  border: "1px solid var(--admin-border)",
                                }}
                              >
                                {initial}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[--admin-text]">
                                {u.telegram_first_name ?? "Без имени"}
                              </p>
                              <p className="truncate text-xs text-[--admin-text-muted] sm:hidden">
                                {formatUzPhone(u.phone_number)}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="hidden px-5 py-3 font-mono text-xs text-[--admin-text-2] sm:table-cell">
                          {formatUzPhone(u.phone_number)}
                        </td>
                        <td className="hidden px-5 py-3 text-xs md:table-cell">
                          {u.telegram_username ? (
                            <span className="text-[--admin-info]">
                              @{u.telegram_username}
                            </span>
                          ) : (
                            <span className="text-[--admin-text-muted]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge label={lifecycleBadge.label} tone={lifecycleBadge.tone} />
                        </td>
                        <td className="hidden px-5 py-3 lg:table-cell">
                          <StatusBadge
                            label={verificationBadge.label}
                            tone={verificationBadge.tone}
                            withDot={false}
                          />
                        </td>
                        <td className="hidden px-5 py-3 text-right text-xs md:table-cell">
                          {(() => {
                            const lastActive = (
                              u as { last_active_at?: string | null }
                            ).last_active_at;
                            if (!lastActive)
                              return (
                                <span className="text-[--admin-text-muted]">—</span>
                              );
                            const ms = Date.now() - new Date(lastActive).getTime();
                            const days = Math.floor(ms / (24 * 60 * 60 * 1000));
                            const hours = Math.floor(ms / (60 * 60 * 1000));
                            const text =
                              days >= 1
                                ? `${days} д назад`
                                : hours >= 1
                                  ? `${hours} ч назад`
                                  : "недавно";
                            return (
                              <span
                                style={{
                                  color:
                                    days > 30
                                      ? "var(--admin-warn)"
                                      : "var(--admin-text-2)",
                                }}
                              >
                                {text}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-[--admin-text-2]">
                          {formatDateTime(u.created_at)}
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/admin/moderation/${u.id}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[--admin-text-muted] transition group-hover:bg-white group-hover:text-[--admin-text] group-hover:shadow-[var(--admin-shadow-sm)]"
                            aria-label="Открыть"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </Link>
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
                  <span className="font-semibold text-[--admin-text]">{totalCount}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  {page > 1 ? (
                    <Link
                      href={buildHref({ page: page - 1 })}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[--admin-border] bg-white px-2.5 font-medium text-[--admin-text-2] transition hover:text-[--admin-text]"
                    >
                      ← Назад
                    </Link>
                  ) : (
                    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[--admin-border] bg-[--admin-surface-2] px-2.5 font-medium text-[--admin-text-muted]">
                      ← Назад
                    </span>
                  )}
                  <span className="px-1">
                    стр. {page} из {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={buildHref({ page: page + 1 })}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[--admin-border] bg-white px-2.5 font-medium text-[--admin-text-2] transition hover:text-[--admin-text]"
                    >
                      Дальше →
                    </Link>
                  ) : (
                    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[--admin-border] bg-[--admin-surface-2] px-2.5 font-medium text-[--admin-text-muted]">
                      Дальше →
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </AdminShell>
  );
}
