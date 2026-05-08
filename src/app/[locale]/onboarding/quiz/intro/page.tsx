import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUserAtStep } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export default async function QuizIntroPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quiz");
  const user = await requireUserAtStep(locale, "quiz_intro");

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
      <ScreenBody>
        <div className="mt-6 flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: "var(--color-blush)",
              color: "var(--color-brand-deep)",
            }}
            aria-hidden
          >
            ✨
          </div>
          <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight text-[--color-plum]">
            {t("intro_title")}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[--color-ink-2]">
            {t("intro_body")}
          </p>
          <div
            className="mt-7 w-full rounded-3xl px-5 py-4 text-left text-[14px] leading-relaxed text-[--color-plum-soft]"
            style={{ backgroundColor: "var(--color-blush-soft)" }}
          >
            {t("intro_help")}
          </div>
        </div>
      </ScreenBody>
      <ScreenFooter>
        <form action={start}>
          <PrimaryButton type="submit">{t("intro_start")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
