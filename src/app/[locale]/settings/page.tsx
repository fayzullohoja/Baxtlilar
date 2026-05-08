import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  Screen,
  ScreenHeader,
  ScreenBody,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clearSessionCookie } from "@/lib/auth/session";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ confirm?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { confirm, error } = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale);

  // Settings only available to active/paused users (post-onboarding).
  // Blocked → /blocked. Deleted → welcome (session is invalid post-delete).
  if (user.lifecycle_state === "blocked") redirect(`/${locale}/blocked`);
  if (user.lifecycle_state === "onboarding") {
    redirect(`/${locale}/onboarding/welcome`);
  }
  if (user.lifecycle_state === "deleted") {
    redirect(`/${locale}/onboarding/welcome`);
  }

  async function pause() {
    "use server";
    await transition(
      user.id,
      { lifecycle_state: "paused", paused_at: new Date().toISOString() },
      "user paused account",
    );
    redirect(`/${locale}/settings`);
  }

  async function resume() {
    "use server";
    await transition(
      user.id,
      { lifecycle_state: "active", paused_at: null },
      "user resumed account",
    );
    redirect(`/${locale}/main`);
  }

  async function deleteAccount() {
    "use server";
    // Wipe all storage objects
    for (const bucket of ["documents", "profile-photos"]) {
      const { data: files } = await supabaseAdmin.storage
        .from(bucket)
        .list(user.id);
      if (files && files.length > 0) {
        await supabaseAdmin.storage
          .from(bucket)
          .remove(files.map((f) => `${user.id}/${f.name}`));
      }
    }
    // Wipe DB rows but keep the user record (audit trail) with deleted state
    await Promise.all([
      supabaseAdmin.from("user_profiles").delete().eq("user_id", user.id),
      supabaseAdmin.from("profile_photos").delete().eq("user_id", user.id),
      supabaseAdmin.from("user_documents").delete().eq("user_id", user.id),
      supabaseAdmin.from("quiz_answers").delete().eq("user_id", user.id),
      supabaseAdmin.from("quiz_results").delete().eq("user_id", user.id),
      supabaseAdmin.from("otp_codes").delete().eq("user_id", user.id),
    ]);
    await transition(
      user.id,
      {
        lifecycle_state: "deleted",
        blocked_at: new Date().toISOString(),
        blocked_reason: "user requested deletion",
      },
      "user deleted own account",
    );
    await clearSessionCookie();
    redirect(`/${locale}/onboarding/welcome`);
  }

  const isPaused = user.lifecycle_state === "paused";
  const askConfirm = confirm === "delete";

  return (
    <Screen>
      <ScreenHeader
        title="Настройки"
        subtitle="Управляйте своим аккаунтом и данными."
      />
      <ScreenBody>
        {error === "delete_failed" ? (
          <p className="mb-4 rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-sm text-[--color-danger]">
            Не удалось удалить аккаунт. Попробуйте ещё раз или напишите в поддержку.
          </p>
        ) : null}

        <section className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
          <div className="border-b border-[--color-line-soft] px-5 py-3">
            <p className="text-sm font-semibold text-[--color-plum]">
              Пауза в подборе
            </p>
            <p className="mt-1 text-xs text-[--color-ink-2]">
              Скрыть свой профиль и не получать рекомендации, пока не вернётесь.
            </p>
          </div>
          <div className="px-5 py-4">
            {isPaused ? (
              <form action={resume}>
                <PrimaryButton type="submit">Возобновить подбор</PrimaryButton>
              </form>
            ) : (
              <form action={pause}>
                <SecondaryButton type="submit">Поставить на паузу</SecondaryButton>
              </form>
            )}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-[--color-danger-bg] bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
          <div
            className="border-b border-[--color-line-soft] px-5 py-3"
            style={{ backgroundColor: "var(--color-danger-bg)" }}
          >
            <p className="text-sm font-semibold text-[--color-danger]">
              Удалить аккаунт
            </p>
            <p className="mt-1 text-xs text-[--color-danger]">
              Безвозвратно удалит ваши фото, анкету, ответы квиза. Восстановить нельзя.
            </p>
          </div>

          {askConfirm ? (
            <form action={deleteAccount} className="flex flex-col gap-3 px-5 py-5">
              <p className="text-sm leading-relaxed text-[--color-plum]">
                Точно удалить? Это действие необратимо. Если хотите просто отдохнуть, поставьте на паузу.
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl text-sm font-semibold text-white"
                  style={{ backgroundColor: "var(--color-danger)" }}
                >
                  Да, удалить
                </button>
                <a
                  href={`/${locale}/settings`}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-[--color-line] bg-white text-sm font-medium text-[--color-plum]"
                >
                  Отмена
                </a>
              </div>
            </form>
          ) : (
            <div className="px-5 py-5">
              <a
                href={`/${locale}/settings?confirm=delete`}
                className="inline-flex h-10 w-full items-center justify-center rounded-2xl border border-[--color-danger] bg-white text-sm font-medium text-[--color-danger]"
              >
                Удалить аккаунт
              </a>
            </div>
          )}
        </section>
      </ScreenBody>
    </Screen>
  );
}
