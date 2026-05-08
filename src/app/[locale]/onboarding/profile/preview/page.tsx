import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton, SecondaryButton } from "@/components/ui/screen";
import { requireUserAtStep } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ProfilePreviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const user = await requireUserAtStep(locale, "profile_preview");
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  async function confirm() {
    "use server";
    await supabaseAdmin
      .from("user_profiles")
      .upsert(
        { user_id: user.id, profile_completed_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    await transition(
      user.id,
      { profile_completion: "completed", onboarding_step: "quiz_intro" },
      "profile confirmed in preview",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.quiz_intro}`);
  }

  async function edit() {
    "use server";
    await transition(
      user.id,
      { onboarding_step: "profile_basic" },
      "edit profile",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.profile_basic}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("preview_title")} />
      <ScreenBody>
        <div className="rounded-3xl bg-white p-6 shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
          <p className="text-lg font-semibold text-[--color-plum]">
            {profile?.display_name ?? "—"}
            {profile?.birth_date ? (
              <span className="ml-2 font-normal text-[--color-plum-mute]">
                · {profile.birth_date}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-[--color-ink-2]">
            {profile?.city ?? "—"}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-[--color-plum-soft]">
            {profile?.about_me ?? "(анкета пока пустая — это заглушка)"}
          </p>
        </div>
      </ScreenBody>
      <ScreenFooter>
        <form action={confirm}>
          <PrimaryButton type="submit">{t("preview_confirm")}</PrimaryButton>
        </form>
        <form action={edit}>
          <SecondaryButton type="submit">{t("preview_edit")}</SecondaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
