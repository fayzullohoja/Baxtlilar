import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton, SecondaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ProfilePreviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const user = await requireUser(locale);
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
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
          <p className="font-medium">
            {profile?.display_name ?? "—"}
            {profile?.birth_date ? `, ${profile.birth_date}` : ""}
          </p>
          <p className="text-neutral-600">{profile?.city ?? "—"}</p>
          <p className="mt-2 whitespace-pre-wrap text-neutral-700">
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
