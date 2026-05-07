import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export default async function QuizIntroPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quiz");
  const user = await requireUser(locale);

  async function start() {
    "use server";
    await transition(
      user.id,
      { onboarding_step: "quiz_in_progress", quiz_completion: "in_progress" },
      "quiz started",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.quiz_in_progress}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("intro_title")} subtitle={t("intro_body")} />
      <ScreenBody>
        <p className="text-sm text-neutral-700">{t("intro_help")}</p>
      </ScreenBody>
      <ScreenFooter>
        <form action={start}>
          <PrimaryButton type="submit">{t("intro_start")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
