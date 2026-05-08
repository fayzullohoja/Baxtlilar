import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
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
      <ScreenBody>
        <div className="mt-8 flex flex-col items-center text-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-4xl"
            style={{
              backgroundColor: "var(--color-success-bg)",
              color: "var(--color-success)",
            }}
            aria-hidden
          >
            ✓
          </div>
          <h1 className="mt-7 text-[28px] font-semibold leading-tight tracking-tight text-[--color-plum]">
            {t("approved_title")}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[--color-ink-2]">
            {t("approved_body")}
          </p>
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
