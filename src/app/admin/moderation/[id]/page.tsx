import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transition } from "@/lib/state-machine/transitions";
import { AdminShell, StatusBadge } from "@/components/admin/shell";
import { RejectForm } from "./reject-form";

async function signedDoc(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

const STATUS_MAP: Record<
  string,
  { label: string; tone: "default" | "warn" | "success" | "danger" | "info" }
> = {
  not_started: { label: "не начата", tone: "default" },
  phone_verified: { label: "телефон подтверждён", tone: "info" },
  documents_uploaded: { label: "паспорт загружен", tone: "info" },
  liveness_uploaded: { label: "selfie загружено", tone: "info" },
  pending_review: { label: "на проверке", tone: "warn" },
  approved: { label: "одобрено", tone: "success" },
  rejected: { label: "отклонено", tone: "danger" },
  revoked: { label: "отозвано", tone: "danger" },
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ModerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!user) redirect("/admin/moderation");

  const { data: doc } = await supabaseAdmin
    .from("user_documents")
    .select(
      "passport_path, passport_uploaded_at, selfie_path, selfie_uploaded_at, submitted_at, rejection_reason, rejection_kind",
    )
    .eq("user_id", id)
    .maybeSingle();

  const passportUrl = await signedDoc(doc?.passport_path);
  const selfieUrl = await signedDoc(doc?.selfie_path);
  const status = STATUS_MAP[user.verification_status] ?? STATUS_MAP.not_started;

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  async function approve() {
    "use server";
    await supabaseAdmin
      .from("user_documents")
      .update({
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
        rejection_kind: null,
      })
      .eq("user_id", id);
    await transition(
      id,
      {
        verification_status: "approved",
        onboarding_step: "profile_basic",
        profile_completion: "in_progress",
      },
      "moderator approved",
      "admin",
    );
    redirect("/admin/moderation");
  }

  async function reject(formData: FormData) {
    "use server";
    const reason = String(formData.get("reason") ?? "Документы не приняты").trim();
    const kind = String(formData.get("kind") ?? "passport");
    await supabaseAdmin
      .from("user_documents")
      .update({
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
        rejection_kind: kind,
      })
      .eq("user_id", id);
    await transition(
      id,
      {
        verification_status: "rejected",
        onboarding_step: "verification_rejected",
      },
      `moderator rejected: ${reason}`,
      "admin",
    );
    redirect("/admin/moderation");
  }

  async function ban() {
    "use server";
    await transition(
      id,
      {
        lifecycle_state: "blocked",
        verification_status: "revoked",
        blocked_at: new Date().toISOString(),
        blocked_reason: "moderator: подделка документов / нарушение правил",
      },
      "moderator banned user",
      "admin",
    );
    redirect("/admin/moderation");
  }

  const initial = (user.telegram_first_name ?? "?")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  const fullName = [user.telegram_first_name, user.telegram_last_name]
    .filter(Boolean)
    .join(" ") || "Без имени";

  return (
    <AdminShell
      title={fullName}
      subtitle={
        user.telegram_username
          ? `@${user.telegram_username} · TG ${user.telegram_id}`
          : `TG ${user.telegram_id}`
      }
      breadcrumb={[
        { label: "Модерация", href: "/admin/moderation" },
        { label: fullName, href: `/admin/moderation/${id}` },
      ]}
      actions={<StatusBadge label={status.label} tone={status.tone} />}
      onLogout={logout}
      activeNav="/admin/moderation"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* LEFT: Documents */}
        <div className="flex flex-col gap-4">
          <DocCard
            title="Паспорт"
            url={passportUrl}
            uploadedAt={doc?.passport_uploaded_at}
            kind="passport"
          />
          <DocCard
            title="Selfie / Liveness"
            url={selfieUrl}
            uploadedAt={doc?.selfie_uploaded_at}
            kind="selfie"
          />
        </div>

        {/* RIGHT: Info + Decision */}
        <div className="flex flex-col gap-4">
          {/* User info */}
          <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
            <div className="border-b border-[--admin-border] bg-[--admin-surface-2] px-5 py-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: "var(--admin-surface)",
                    color: "var(--admin-text-2)",
                    border: "1px solid var(--admin-border)",
                  }}
                >
                  {initial}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[--admin-text]">
                    {fullName}
                  </p>
                  <p className="text-xs text-[--admin-text-muted]">
                    Заявка #{id.slice(0, 8)}
                  </p>
                </div>
              </div>
            </div>
            <dl className="divide-y divide-[--admin-border]">
              <Row label="Telegram ID" value={String(user.telegram_id)} mono />
              <Row label="Username" value={user.telegram_username ? `@${user.telegram_username}` : "—"} />
              <Row label="Телефон" value={user.phone_number ?? "—"} mono />
              <Row label="Язык" value={user.language?.toUpperCase() ?? "—"} />
              <Row
                label="Создан"
                value={formatDateTime(user.created_at)}
              />
              <Row
                label="Заявка подана"
                value={formatDateTime(doc?.submitted_at)}
              />
              {doc?.rejection_reason ? (
                <Row
                  label="Прошлая отбраковка"
                  value={doc.rejection_reason}
                  hint={doc.rejection_kind ?? undefined}
                />
              ) : null}
            </dl>
          </section>

          {/* Decision */}
          <section className="rounded-xl border border-[--admin-border] bg-white p-5 shadow-[var(--admin-shadow-sm)]">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[--admin-text]">
                Решение модератора
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[--admin-text-2]">
                Проверьте, что фото читаются, лицо на selfie совпадает с
                паспортом, документ не подделан.
              </p>
            </div>

            <form action={approve}>
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow-[var(--admin-shadow-sm)] transition hover:brightness-110 active:brightness-95"
                style={{ backgroundColor: "var(--admin-success)" }}
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3.5 8.5l3 3 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Одобрить
              </button>
            </form>

            <details className="group mt-3 overflow-hidden rounded-lg border border-[--admin-border]">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs font-semibold text-[--admin-danger] [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 5v3.5M8 11h.01M2.5 13.5h11a1 1 0 0 0 .87-1.5L8.87 3a1 1 0 0 0-1.74 0L1.63 12a1 1 0 0 0 .87 1.5z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Отклонить заявку
                </span>
                <svg
                  className="h-3.5 w-3.5 transition group-open:rotate-180"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <RejectForm rejectAction={reject} />
            </details>

            {/* Ban — destructive escalation, separated from reject */}
            <details className="group mt-3 overflow-hidden rounded-lg border border-[--admin-border]">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs font-semibold text-[--admin-text-2] [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M3.8 3.8l8.4 8.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  Заблокировать пользователя
                </span>
                <svg
                  className="h-3.5 w-3.5 transition group-open:rotate-180"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <form
                action={ban}
                className="flex flex-col gap-3 border-t border-[--admin-border] bg-[--admin-surface-2] px-4 py-4"
              >
                <p className="text-xs leading-relaxed text-[--admin-text-2]">
                  Юзер потеряет доступ навсегда. Используйте для подделки
                  документов, фрода, повторных нарушений. Telegram ID будет
                  записан с пометкой о блокировке.
                </p>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-md text-xs font-semibold text-white transition hover:brightness-110 active:brightness-95"
                  style={{ backgroundColor: "var(--admin-text)" }}
                >
                  Подтвердить блокировку
                </button>
              </form>
            </details>

          </section>
        </div>
      </div>
    </AdminShell>
  );
}

function Row({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-2.5">
      <dt className="shrink-0 text-xs text-[--admin-text-muted]">{label}</dt>
      <dd className="text-right">
        <p
          className={`text-sm text-[--admin-text] ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
        </p>
        {hint ? (
          <p className="text-[11px] text-[--admin-text-muted]">{hint}</p>
        ) : null}
      </dd>
    </div>
  );
}

function DocCard({
  title,
  url,
  uploadedAt,
  kind,
}: {
  title: string;
  url: string | null;
  uploadedAt: string | null | undefined;
  kind: "passport" | "selfie";
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
      <div className="flex items-center justify-between border-b border-[--admin-border] bg-[--admin-surface-2] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{
              backgroundColor: "var(--admin-info-bg)",
              color: "var(--admin-info)",
            }}
            aria-hidden
          >
            {kind === "passport" ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 13c0-2.5 2-4.5 5-4.5s5 2 5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </span>
          <p className="text-sm font-semibold text-[--admin-text]">{title}</p>
        </div>
        {uploadedAt ? (
          <p className="text-[11px] text-[--admin-text-muted]">
            {formatDateTime(uploadedAt)}
          </p>
        ) : null}
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={title} className="block w-full" />
        </a>
      ) : (
        <div
          className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm text-[--admin-text-muted]"
          style={{ backgroundColor: "var(--admin-surface-2)" }}
        >
          <svg className="h-7 w-7 opacity-50" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M3 10l9-7 9 7M9 21V11h6v10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p>Нет файла</p>
        </div>
      )}
    </section>
  );
}
