import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie, requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transition } from "@/lib/state-machine/transitions";
import { AdminShell, StatusBadge } from "@/components/admin/shell";
import { KeyboardShortcuts } from "@/components/admin/keyboard-shortcuts";
import { notifyUserTelegram } from "@/lib/admin/notify";
import { RejectForm } from "./reject-form";
import { ImageViewer } from "./image-viewer";
import { ResetForm } from "./reset-form";

async function signedDoc(path: string | null | undefined) {
  if (!path) return null;
  // 4-hour TTL — survives lunch breaks during moderation. Short enough that
  // a casually-shared signed URL becomes worthless quickly.
  const { data } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUrl(path, 4 * 60 * 60);
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

  // Recent state transitions for this user
  const { data: recentTransitions } = await supabaseAdmin
    .from("user_state_transitions")
    .select("id, field, old_value, new_value, reason, triggered_by, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Profile + quiz (may be null if user hasn't reached those steps)
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select(
      "display_name, birth_date, gender, city, district, marital_status, education_level, work_industry, profession, employment_status, has_children, wants_children, marriage_timeline, religiosity_level, smoking_status, alcohol_status, interests, looking_for_gender, preferred_age_min, preferred_age_max, preferred_partner_qualities, about_me, marriage_values_text",
    )
    .eq("user_id", id)
    .maybeSingle();

  const { data: quiz } = await supabaseAdmin
    .from("quiz_results")
    .select(
      "intention_type, relationship_tempo, communication_style, family_values_score, conflict_style, privacy_preference, match_priority_score",
    )
    .eq("user_id", id)
    .maybeSingle();

  // Profile photos (after moderation approval, user uploads these)
  const { data: profilePhotos } = await supabaseAdmin
    .from("profile_photos")
    .select("id, storage_path, is_main")
    .eq("user_id", id)
    .order("is_main", { ascending: false });
  const profilePhotoUrls: { id: string; url: string; isMain: boolean }[] = [];
  if (profilePhotos) {
    for (const p of profilePhotos) {
      const { data } = await supabaseAdmin.storage
        .from("profile-photos")
        .createSignedUrl(p.storage_path, 4 * 60 * 60);
      if (data?.signedUrl) {
        profilePhotoUrls.push({
          id: p.id,
          url: data.signedUrl,
          isMain: p.is_main,
        });
      }
    }
  }

  // Surrounding pending users for keyboard J/K navigation
  let nextHref: string | null = null;
  let prevHref: string | null = null;
  if (user.verification_status === "pending_review") {
    const { data: pending } = await supabaseAdmin
      .from("users")
      .select("id, created_at")
      .eq("verification_status", "pending_review")
      .order("created_at", { ascending: true });
    if (pending) {
      const idx = pending.findIndex((p) => p.id === id);
      if (idx >= 0) {
        if (idx + 1 < pending.length)
          nextHref = `/admin/moderation/${pending[idx + 1].id}`;
        if (idx - 1 >= 0)
          prevHref = `/admin/moderation/${pending[idx - 1].id}`;
      }
    }
  }

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  async function approve() {
    "use server";
    await requireAdmin();
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
    void notifyUserTelegram(
      Number(user.telegram_id),
      `🎉 <b>Анкета одобрена!</b>\n\nДобро пожаловать на Bakhtlilar. Вернитесь в приложение, чтобы заполнить профиль.`,
    );
    redirect("/admin/moderation");
  }

  async function approveAndNext() {
    "use server";
    await requireAdmin();
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
      "moderator approved (and-next flow)",
      "admin",
    );
    void notifyUserTelegram(
      Number(user.telegram_id),
      `🎉 <b>Анкета одобрена!</b>\n\nДобро пожаловать на Bakhtlilar. Вернитесь в приложение, чтобы заполнить профиль.`,
    );
    // Find next oldest pending user (excluding the one we just approved — but it's no longer pending anyway)
    const { data: next } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("verification_status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next?.id) redirect(`/admin/moderation/${next.id}`);
    redirect("/admin/moderation");
  }

  async function reject(formData: FormData) {
    "use server";
    await requireAdmin();
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
    void notifyUserTelegram(
      Number(user.telegram_id),
      `📋 <b>Документы нужно переснять</b>\n\n${reason}\n\nОткройте приложение, чтобы загрузить новые фото.`,
    );
    redirect("/admin/moderation");
  }

  async function resetOnboarding(formData: FormData) {
    "use server";
    await requireAdmin();
    const validSteps = new Set([
      "language",
      "phone_input",
      "document_upload",
      "profile_basic",
      "profile_photos",
      "profile_education",
      "quiz_intro",
    ]);
    const step = String(formData.get("step") ?? "");
    if (!validSteps.has(step)) {
      redirect(`/admin/moderation/${id}`);
    }
    const wipeProfile = formData.get("wipe_profile") === "on";
    const wipeQuiz = formData.get("wipe_quiz") === "on";

    if (wipeProfile) {
      await supabaseAdmin.from("user_profiles").delete().eq("user_id", id);
      // Also clear photos so user re-uploads cleanly
      const { data: photos } = await supabaseAdmin
        .from("profile_photos")
        .select("storage_path")
        .eq("user_id", id);
      if (photos && photos.length > 0) {
        await supabaseAdmin.storage
          .from("profile-photos")
          .remove(photos.map((p) => p.storage_path));
        await supabaseAdmin.from("profile_photos").delete().eq("user_id", id);
      }
    }
    if (wipeQuiz) {
      await supabaseAdmin.from("quiz_answers").delete().eq("user_id", id);
      await supabaseAdmin.from("quiz_results").delete().eq("user_id", id);
    }

    // Step → derived sub-states
    const profileCompletion =
      step === "language" || step === "phone_input"
        ? "not_started"
        : step.startsWith("profile_")
          ? "in_progress"
          : "in_progress";
    const quizCompletion = step === "quiz_intro" ? "in_progress" : "not_started";
    const verificationStatus =
      step === "language" || step === "phone_input"
        ? "not_started"
        : step === "document_upload"
          ? "phone_verified"
          : "approved";

    await transition(
      id,
      {
        lifecycle_state: "onboarding",
        onboarding_step: step as never, // narrowed by validSteps check above
        profile_completion: profileCompletion as never,
        quiz_completion: quizCompletion as never,
        verification_status: verificationStatus as never,
      },
      `moderator reset to ${step}${wipeProfile ? " (wiped profile)" : ""}${wipeQuiz ? " (wiped quiz)" : ""}`,
      "admin",
    );
    redirect(`/admin/moderation/${id}`);
  }

  async function ban(formData: FormData) {
    "use server";
    await requireAdmin();
    const reason =
      String(formData.get("reason") ?? "").trim() ||
      "moderator: нарушение правил сервиса";
    await transition(
      id,
      {
        lifecycle_state: "blocked",
        verification_status: "revoked",
        blocked_at: new Date().toISOString(),
        blocked_reason: reason,
      },
      `moderator banned user: ${reason}`,
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

            <div className="flex flex-col gap-2">
              <form action={approveAndNext}>
                <button
                  type="submit"
                  data-shortcut="approve-next"
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
                  Одобрить и следующий
                  <kbd className="ml-1 rounded border border-white/30 bg-white/10 px-1 text-[10px] font-mono">A</kbd>
                </button>
              </form>
              <form action={approve}>
                <button
                  type="submit"
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium text-[--admin-text-2] transition hover:text-[--admin-text]"
                >
                  Одобрить и вернуться к очереди
                </button>
              </form>
            </div>

            <details
              data-shortcut="reject-toggle"
              className="group mt-3 overflow-hidden rounded-lg border border-[--admin-border]"
            >
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
                  <kbd className="ml-1 rounded border border-[--admin-border] bg-[--admin-surface-2] px-1 font-mono text-[10px] font-normal text-[--admin-text-muted]">R</kbd>
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

            {/* Reset onboarding — debug/recovery tool */}
            <details className="group mt-3 overflow-hidden rounded-lg border border-[--admin-border]">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-xs font-semibold text-[--admin-warn] [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M14 8a6 6 0 11-1.76-4.24M14 3v3.5h-3.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Сбросить онбординг
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
              <ResetForm resetAction={resetOnboarding} />
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
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
                    Причина (видна в /admin/banned + /blocked для юзера)
                  </span>
                  <textarea
                    name="reason"
                    placeholder="Например: подделка паспорта (повтор после отклонения)"
                    className="min-h-[60px] resize-none rounded-md border border-[--admin-border] bg-white px-3 py-2 text-xs text-[--admin-text] placeholder:text-[--admin-text-muted]"
                  />
                </label>
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

      {/* Bottom row: profile + audit log */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ProfileCard
          profile={profile}
          quiz={quiz}
          profilePhotos={profilePhotoUrls}
        />
        <AuditCard transitions={recentTransitions ?? []} userId={id} />
      </div>

      <KeyboardShortcuts
        type="detail"
        queueHref="/admin/moderation"
        nextHref={nextHref}
        prevHref={prevHref}
      />
      <ImageViewer passportUrl={passportUrl} selfieUrl={selfieUrl} />
    </AdminShell>
  );
}

function ProfileCard({
  profile,
  quiz,
  profilePhotos,
}: {
  profile: Record<string, unknown> | null;
  quiz: Record<string, unknown> | null;
  profilePhotos: { id: string; url: string; isMain: boolean }[];
}) {
  const hasProfile =
    profile && Object.values(profile).some((v) => v != null && v !== "");
  const hasPhotos = profilePhotos.length > 0;
  return (
    <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
      {hasPhotos ? (
        <div className="border-b border-[--admin-border] bg-[--admin-surface-2] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
            Профильные фото
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {profilePhotos.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block overflow-hidden rounded-md"
                title={p.isMain ? "main" : "extra"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
                {p.isMain ? (
                  <span
                    className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[9px] font-semibold text-white"
                    aria-hidden
                  >
                    main
                  </span>
                ) : null}
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between border-b border-[--admin-border] bg-[--admin-surface-2] px-5 py-3">
        <h2 className="text-sm font-semibold text-[--admin-text]">Анкета и квиз</h2>
        {!hasProfile ? (
          <span className="text-[11px] text-[--admin-text-muted]">пусто</span>
        ) : null}
      </div>
      {!hasProfile ? (
        <p className="px-5 py-8 text-center text-sm text-[--admin-text-2]">
          Юзер ещё не дошёл до анкеты
        </p>
      ) : (
        <dl className="divide-y divide-[--admin-border]">
          {profile?.display_name ? (
            <Row label="Имя" value={String(profile.display_name)} />
          ) : null}
          {profile?.birth_date ? (
            <Row
              label="Дата рожд."
              value={String(profile.birth_date)}
              hint={
                typeof profile.birth_date === "string"
                  ? `${calcAge(profile.birth_date)} лет`
                  : undefined
              }
            />
          ) : null}
          {profile?.gender ? (
            <Row
              label="Пол"
              value={profile.gender === "female" ? "Жен" : "Муж"}
            />
          ) : null}
          {profile?.city ? (
            <Row
              label="Город"
              value={
                String(profile.city) +
                (profile.district ? `, ${profile.district}` : "")
              }
            />
          ) : null}
          {profile?.marital_status ? (
            <Row label="Семейный статус" value={String(profile.marital_status)} />
          ) : null}
          {profile?.profession ? (
            <Row
              label="Профессия"
              value={String(profile.profession)}
              hint={profile.work_industry ? String(profile.work_industry) : undefined}
            />
          ) : null}
          {profile?.education_level ? (
            <Row label="Образование" value={String(profile.education_level)} />
          ) : null}
          {profile?.has_children ? (
            <Row
              label="Дети"
              value={
                String(profile.has_children) +
                (profile.wants_children ? ` · хочет: ${profile.wants_children}` : "")
              }
            />
          ) : null}
          {profile?.marriage_timeline ? (
            <Row label="Готов к браку" value={String(profile.marriage_timeline)} />
          ) : null}
          {profile?.about_me ? (
            <div className="px-5 py-3">
              <dt className="text-xs text-[--admin-text-muted]">О себе</dt>
              <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[--admin-text]">
                {String(profile.about_me)}
              </dd>
            </div>
          ) : null}
          {quiz ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-[--admin-surface-2] px-5 py-4">
              {(
                [
                  ["Намерение", quiz.intention_type],
                  ["Темп", quiz.relationship_tempo],
                  ["Стиль общения", quiz.communication_style],
                  ["Семейные ценности", `${quiz.family_values_score ?? 0} / 4`],
                  ["Конфликты", quiz.conflict_style],
                  ["Match priority", quiz.match_priority_score],
                ] as const
              ).map(([label, val]) =>
                val != null && val !== "" ? (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
                      {label}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-[--admin-text]">
                      {String(val)}
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}

interface TransitionRow {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  triggered_by: string | null;
  created_at: string;
}

function AuditCard({
  transitions,
  userId,
}: {
  transitions: TransitionRow[];
  userId: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
      <div className="flex items-center justify-between border-b border-[--admin-border] bg-[--admin-surface-2] px-5 py-3">
        <h2 className="text-sm font-semibold text-[--admin-text]">
          История переходов
        </h2>
        <a
          href={`/admin/audit?user=${userId}`}
          className="text-[11px] text-[--admin-info] hover:underline"
        >
          Полный лог →
        </a>
      </div>
      {transitions.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[--admin-text-2]">
          Пока без изменений
        </p>
      ) : (
        <ol className="flex flex-col">
          {transitions.map((t) => {
            const triggerColor =
              t.triggered_by === "admin"
                ? "var(--admin-accent-deep)"
                : t.triggered_by === "user"
                  ? "var(--admin-info)"
                  : "var(--admin-text-muted)";
            return (
              <li
                key={t.id}
                className="flex flex-col gap-1 border-b border-[--admin-border] px-5 py-3 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                      style={{
                        backgroundColor: "var(--admin-surface-2)",
                        color: "var(--admin-text-2)",
                      }}
                    >
                      {t.field}
                    </span>
                    <span className="font-mono text-[--admin-text-muted]">
                      {t.old_value || "∅"}
                    </span>
                    <span className="text-[--admin-text-muted]">→</span>
                    <span className="font-mono font-semibold text-[--admin-text]">
                      {t.new_value || "∅"}
                    </span>
                  </div>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      color: triggerColor,
                    }}
                  >
                    {t.triggered_by ?? "—"}
                  </span>
                </div>
                {t.reason ? (
                  <p className="text-xs text-[--admin-text-2]">{t.reason}</p>
                ) : null}
                <p className="text-[10px] text-[--admin-text-muted]">
                  {new Date(t.created_at).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function calcAge(birthDate: string): number {
  const b = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
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
        <button
          type="button"
          data-zoom={kind}
          className="block w-full cursor-zoom-in border-0 p-0 transition hover:opacity-95"
          aria-label={`Открыть ${title} в полном размере`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={title} className="block w-full" />
        </button>
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
