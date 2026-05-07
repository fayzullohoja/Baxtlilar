import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export default async function ModerationApprovedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("moderation");
  const user = await requireUser(locale);

  async function next() {
    "use server";
    await transition(
      user.id,
      { onboarding_step: "profile_basic", profile_completion: "in_progress" },
      "starts filling profile",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.profile_basic}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("approved_title")} subtitle={t("approved_body")} />
      <ScreenBody>
        <div className="flex h-32 items-center justify-center rounded-xl border border-green-200 bg-green-50 text-3xl">
          ✓
        </div>
      </ScreenBody>
      <ScreenFooter>
        <form action={next}>
          <PrimaryButton type="submit">{t("approved_continue")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
