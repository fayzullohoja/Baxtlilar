import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transition } from "@/lib/state-machine/transitions";
import { LogoLockup } from "@/components/brand/logo";

async function signedDoc(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

const STATUS_LABELS: Record<string, { label: string; tone: "warn" | "success" | "danger" | "neutral" }> = {
  not_started: { label: "не начата", tone: "neutral" },
  phone_verified: { label: "телефон подтверждён", tone: "neutral" },
  documents_uploaded: { label: "паспорт загружен", tone: "neutral" },
  liveness_uploaded: { label: "selfie загружено", tone: "neutral" },
  pending_review: { label: "на проверке", tone: "warn" },
  approved: { label: "одобрено", tone: "success" },
  rejected: { label: "отклонено", tone: "danger" },
  revoked: { label: "отозвано", tone: "danger" },
};

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
    .select("passport_path, passport_uploaded_at, selfie_path, selfie_uploaded_at, submitted_at, rejection_reason")
    .eq("user_id", id)
    .maybeSingle();

  const passportUrl = await signedDoc(doc?.passport_path);
  const selfieUrl = await signedDoc(doc?.selfie_path);
  const status = STATUS_LABELS[user.verification_status] ?? STATUS_LABELS.not_started;

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

  const initial =
    (user.telegram_first_name ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <div className="min-h-dvh bg-[--color-cream]">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        {/* Top bar */}
        <header className="mb-7 flex items-center justify-between">
          <LogoLockup size={28} />
          <Link
            href="/admin/moderation"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-[--color-plum] hover:text-[--color-brand-deep]"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M13 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            К очереди
          </Link>
        </header>

        {/* Profile header card */}
        <section className="mb-5 overflow-hidden rounded-3xl bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
          <div
            className="h-20"
            style={{
              background:
                "linear-gradient(135deg, var(--color-blush) 0%, var(--color-cream-2) 100%)",
            }}
          />
          <div className="px-7 pb-7">
            <div className="-mt-12 flex items-end gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border-4 border-white text-2xl font-bold shadow-[0_4px_16px_rgba(74,44,53,0.08)]"
                style={{
                  backgroundColor: "var(--color-blush)",
                  color: "var(--color-brand-deep)",
                }}
              >
                {initial}
              </div>
              <div className="flex-1 pb-2">
                <StatusPill status={status} />
              </div>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[--color-plum]">
              {user.telegram_first_name ?? "Без имени"}
              {user.telegram_username ? (
                <span className="ml-2 text-base font-normal text-[--color-ink-muted]">
                  @{user.telegram_username}
                </span>
              ) : null}
            </h1>
            <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
              <Info label="Telegram ID" value={String(user.telegram_id)} />
              <Info label="Телефон" value={user.phone_number ?? "—"} mono />
              <Info label="Язык" value={user.language?.toUpperCase() ?? "—"} />
              <Info
                label="Заявка подана"
                value={
                  doc?.submitted_at
                    ? new Date(doc.submitted_at).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"
                }
              />
            </dl>
          </div>
        </section>

        {/* Documents grid */}
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Photo title="Паспорт" url={passportUrl} uploadedAt={doc?.passport_uploaded_at} />
          <Photo title="Selfie / Liveness" url={selfieUrl} uploadedAt={doc?.selfie_uploaded_at} />
        </section>

        {/* Actions */}
        <section className="rounded-3xl bg-white p-6 shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
          <h2 className="text-base font-semibold text-[--color-plum]">
            Решение
          </h2>
          <p className="mt-1 text-sm text-[--color-ink-2]">
            Проверьте, что фото читаются, лицо на selfie совпадает с фото в паспорте, и документ не подделан.
          </p>

          <form action={approve} className="mt-5">
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(92,155,122,0.5)] transition active:scale-[.99]"
              style={{ backgroundColor: "var(--color-success)" }}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 10.5l3.5 3.5L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Одобрить
            </button>
          </form>

          <details className="group mt-3 rounded-2xl border border-[--color-line] open:bg-[--color-blush-soft]">
            <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-sm font-semibold text-[--color-danger] [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M10 6v4m0 3.5v.01M3 17h14a1 1 0 0 0 .9-1.4L10.9 3.6a1 1 0 0 0-1.8 0L2.1 15.6A1 1 0 0 0 3 17z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Отклонить с указанием причины
              </span>
              <svg
                className="h-4 w-4 transition group-open:rotate-180"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
              >
                <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <form action={reject} className="flex flex-col gap-3 px-5 pb-5">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
                  Что переснять
                </span>
                <select
                  name="kind"
                  className="h-11 rounded-xl border border-[--color-line] bg-white px-3 text-sm text-[--color-plum]"
                >
                  <option value="passport">Только паспорт</option>
                  <option value="selfie">Только selfie</option>
                  <option value="both">Оба фото</option>
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
                  Причина для пользователя
                </span>
                <textarea
                  name="reason"
                  placeholder="Например: фото размыто, данные не читаются, selfie не совпадает с паспортом"
                  className="min-h-[80px] rounded-xl border border-[--color-line] bg-white p-3 text-sm text-[--color-plum] placeholder:text-[--color-ink-muted]"
                  required
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl text-sm font-semibold text-white transition active:scale-[.99]"
                style={{ backgroundColor: "var(--color-danger)" }}
              >
                Отправить отклонение
              </button>
            </form>
          </details>
        </section>
      </div>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: { label: string; tone: "warn" | "success" | "danger" | "neutral" };
}) {
  const styles = {
    warn: { bg: "var(--color-warn-bg)", text: "var(--color-warn)" },
    success: { bg: "var(--color-success-bg)", text: "var(--color-success)" },
    danger: { bg: "var(--color-danger-bg)", text: "var(--color-danger)" },
    neutral: { bg: "var(--color-blush)", text: "var(--color-plum-soft)" },
  }[status.tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: styles.bg, color: styles.text }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: styles.text }}
      />
      {status.label}
    </span>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[--color-ink-muted]">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm text-[--color-plum] ${mono ? "font-mono" : "font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Photo({
  title,
  url,
  uploadedAt,
}: {
  title: string;
  url: string | null;
  uploadedAt: string | null | undefined;
}) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
      <div className="flex items-center justify-between border-b border-[--color-line-soft] px-5 py-3.5">
        <p className="text-sm font-semibold text-[--color-plum]">{title}</p>
        {uploadedAt ? (
          <p className="text-[11px] text-[--color-ink-muted]">
            {new Date(uploadedAt).toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : null}
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="block w-full" />
      ) : (
        <div
          className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-[--color-ink-muted]"
          style={{ backgroundColor: "var(--color-cream-2)" }}
        >
          <svg className="h-8 w-8 opacity-50" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M21 15V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M3 10l9-7 9 7M9 21V11h6v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>Нет файла</p>
        </div>
      )}
    </div>
  );
}
