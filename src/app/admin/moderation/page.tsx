import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie, requireAdmin } from "@/lib/admin/guard";
import { VERIFICATION_LABELS as STATUS_BADGE } from "@/lib/admin/labels";
import { formatUzPhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transition } from "@/lib/state-machine/transitions";
import { AdminShell, StatTile, StatusBadge } from "@/components/admin/shell";
import { KeyboardShortcuts } from "@/components/admin/keyboard-shortcuts";
import { BulkProvider, BulkBar, BulkCheckbox } from "./bulk-actions";

const PAGE_SIZE = 50;

const STATUS_FILTERS = [
  { key: "pending_review", label: "В очереди", tone: "warn" as const },
  { key: "approved", label: "Одобренные", tone: "success" as const },
  { key: "rejected", label: "Отклонённые", tone: "danger" as const },
  { key: "all", label: "Все", tone: "default" as const },
];


function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  return `${d} д`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ModerationListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const sp = await searchParams;
  const statusFilter = sp.status ?? "pending_review";
  const search = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Counts for stats
  const { data: stats } = await supabaseAdmin
    .from("users")
    .select("verification_status");
  const counts = (stats ?? []).reduce<Record<string, number>>((acc, u) => {
    acc[u.verification_status] = (acc[u.verification_status] ?? 0) + 1;
    return acc;
  }, {});
  const totalUsers = stats?.length ?? 0;

  // Build filtered query
  let q = supabaseAdmin
    .from("users")
    .select(
      "id, telegram_id, telegram_username, telegram_first_name, phone_number, language, verification_status, onboarding_step, created_at",
      { count: "exact" },
    );

  if (statusFilter !== "all") {
    q = q.eq("verification_status", statusFilter);
  }

  if (search) {
    const escaped = search.replace(/[%,]/g, " ");
    // Numeric → telegram_id; else → name/username/phone
    if (/^\d+$/.test(escaped)) {
      q = q.or(
        `telegram_id.eq.${escaped},phone_number.ilike.%${escaped}%`,
      );
    } else {
      q = q.or(
        `telegram_first_name.ilike.%${escaped}%,telegram_username.ilike.%${escaped}%,phone_number.ilike.%${escaped}%`,
      );
    }
  }

  // Order: pending = oldest first (FIFO); other statuses = newest first
  q =
    statusFilter === "pending_review"
      ? q.order("created_at", { ascending: true })
      : q.order("created_at", { ascending: false });

  const { data: rows, count } = await q.range(offset, offset + PAGE_SIZE - 1);
  const items = rows ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  async function bulkReject(formData: FormData) {
    "use server";
    await requireAdmin();
    const userIds = formData
      .getAll("user_id")
      .map(String)
      .filter((s) => /^[0-9a-f-]{36}$/i.test(s));
    if (userIds.length === 0) return;
    const reason = String(formData.get("reason") ?? "").trim();
    const kind = String(formData.get("kind") ?? "both");
    if (reason.length < 10) {
      return; // client should have prevented this; bail safely
    }
    await supabaseAdmin
      .from("user_documents")
      .update({
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
        rejection_kind: kind,
      })
      .in("user_id", userIds);
    await Promise.all(
      userIds.map((id) =>
        transition(
          id,
          {
            verification_status: "rejected",
            onboarding_step: "verification_rejected",
          },
          `bulk reject (${userIds.length} total): ${reason}`,
          "admin",
        ),
      ),
    );
    redirect("/admin/moderation");
  }

  async function bulkApprove(formData: FormData) {
    "use server";
    await requireAdmin();
    const userIds = formData
      .getAll("user_id")
      .map(String)
      .filter((s) => /^[0-9a-f-]{36}$/i.test(s));
    if (userIds.length === 0) return;
    // Mark documents reviewed for all
    await supabaseAdmin
      .from("user_documents")
      .update({
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
        rejection_kind: null,
      })
      .in("user_id", userIds);
    // Transition each (writes audit log)
    await Promise.all(
      userIds.map((id) =>
        transition(
          id,
          {
            verification_status: "approved",
            onboarding_step: "profile_basic",
            profile_completion: "in_progress",
          },
          `bulk approve (${userIds.length} total)`,
          "admin",
        ),
      ),
    );
    redirect("/admin/moderation");
  }

  function buildHref(opts: { status?: string; q?: string; page?: number }) {
    const p = new URLSearchParams();
    const newStatus = opts.status ?? statusFilter;
    if (newStatus !== "pending_review") p.set("status", newStatus);
    const newSearch = opts.q ?? search;
    if (newSearch) p.set("q", newSearch);
    if (opts.page && opts.page > 1) p.set("page", String(opts.page));
    const qs = p.toString();
    return `/admin/moderation${qs ? `?${qs}` : ""}`;
  }

  return (
    <AdminShell
      title="Модерация"
      subtitle="Проверьте паспорт и selfie. Одобряйте, если данные читаются и совпадают."
      onLogout={logout}
      activeNav="/admin/moderation"
    >
      {/* Stats */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="В очереди" value={counts.pending_review ?? 0} tone="warn" />
        <StatTile label="Одобрено" value={counts.approved ?? 0} tone="success" />
        <StatTile label="Отклонено" value={counts.rejected ?? 0} tone="danger" />
        <StatTile label="Всего юзеров" value={totalUsers} />
      </section>

      {/* Tabs + Search */}
      <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
        <div className="flex flex-col gap-3 border-b border-[--admin-border] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div
            role="tablist"
            className="inline-flex items-center gap-1 rounded-lg p-1"
            style={{ backgroundColor: "var(--admin-surface-2)" }}
          >
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              const count =
                f.key === "all" ? totalUsers : counts[f.key] ?? 0;
              return (
                <Link
                  key={f.key}
                  href={buildHref({ status: f.key, page: 1 })}
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
                    style={{
                      backgroundColor: active
                        ? "var(--admin-surface-2)"
                        : "transparent",
                      color: "var(--admin-text-muted)",
                    }}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Search */}
          <form className="flex items-center gap-2" action="/admin/moderation">
            {statusFilter !== "pending_review" ? (
              <input type="hidden" name="status" value={statusFilter} />
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

        {/* Table or empty state */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={
                statusFilter === "pending_review"
                  ? { backgroundColor: "var(--admin-success-bg)", color: "var(--admin-success)" }
                  : { backgroundColor: "var(--admin-surface-2)", color: "var(--admin-text-muted)" }
              }
              aria-hidden
            >
              {statusFilter === "pending_review" ? (
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none">
                  <path d="M5 10.5l3.5 3.5L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 7v4M10 13h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <h3 className="text-base font-semibold text-[--admin-text]">
              {search
                ? "Никого не нашли"
                : statusFilter === "pending_review"
                  ? "Очередь пуста"
                  : "Пока пусто"}
            </h3>
            <p className="mt-1 text-sm text-[--admin-text-2]">
              {search
                ? "Попробуйте другой запрос"
                : statusFilter === "pending_review"
                  ? "Все заявки обработаны"
                  : "Заявки появятся здесь"}
            </p>
          </div>
        ) : (
          <BulkProvider
            rowIds={items.map((u) => u.id)}
            approveAction={bulkApprove}
            rejectAction={bulkReject}
          >
            {statusFilter === "pending_review" ? <BulkBar /> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--admin-border] bg-[--admin-surface-2] text-left text-[11px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
                    {statusFilter === "pending_review" ? (
                      <th className="w-10 px-3 py-2.5"></th>
                    ) : null}
                    <th className="px-5 py-2.5 font-semibold">Пользователь</th>
                    <th className="hidden px-5 py-2.5 font-semibold sm:table-cell">Контакт</th>
                    <th className="hidden px-5 py-2.5 font-semibold md:table-cell">Telegram</th>
                    <th className="hidden px-5 py-2.5 font-semibold md:table-cell">Язык</th>
                    <th className="px-5 py-2.5 font-semibold">Статус</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Подано</th>
                    <th className="w-12 px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => {
                    const initial = (u.telegram_first_name ?? "?")
                      .trim()
                      .slice(0, 1)
                      .toUpperCase();
                    const badge =
                      STATUS_BADGE[u.verification_status] ?? STATUS_BADGE.not_started;
                    return (
                      <tr
                        key={u.id}
                        data-queue-row={`/admin/moderation/${u.id}`}
                        className="group border-b border-[--admin-border] last:border-b-0 transition hover:bg-[--admin-row-hover] data-[focused=true]:bg-[--admin-info-bg]"
                      >
                        {statusFilter === "pending_review" ? (
                          <td className="px-3 py-3 text-center">
                            <BulkCheckbox id={u.id} />
                          </td>
                        ) : null}
                        <td className="px-5 py-3">
                          <Link
                            href={`/admin/moderation/${u.id}`}
                            className="flex items-center gap-3"
                          >
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
                          <span className="ml-1.5 font-mono text-[--admin-text-muted]">
                            {String(u.telegram_id)}
                          </span>
                        </td>
                        <td className="hidden px-5 py-3 text-xs uppercase text-[--admin-text-2] md:table-cell">
                          {u.language ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          {(() => {
                            const ageHours =
                              (Date.now() - new Date(u.created_at).getTime()) /
                              (60 * 60 * 1000);
                            const isStale =
                              u.verification_status === "pending_review" &&
                              ageHours > 24;
                            return (
                              <StatusBadge
                                label={isStale ? "⚠ Просрочено" : badge.label}
                                tone={isStale ? "danger" : badge.tone}
                              />
                            );
                          })()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-sm text-[--admin-text]">
                            {timeAgo(u.created_at)}
                          </p>
                          <p className="hidden text-[11px] text-[--admin-text-muted] sm:block">
                            {formatDateTime(u.created_at)}
                          </p>
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

            {/* Pagination footer */}
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
          </BulkProvider>
        )}
      </section>
      <KeyboardShortcuts
        type="queue"
        rows={items.map((u) => `/admin/moderation/${u.id}`)}
      />
    </AdminShell>
  );
}
