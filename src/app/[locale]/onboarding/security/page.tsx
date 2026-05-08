import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUserAtStep } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export default async function SecurityIntroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("security");
  const tc = await getTranslations("common");
  const user = await requireUserAtStep(locale, "security_intro");

  async function next() {
    "use server";
    await transition(
      user.id,
      { onboarding_step: "phone_input", security_intro_seen: true },
      "saw security intro",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.phone_input}`);
  }

  const steps = [
    t("step_phone"),
    t("step_passport"),
    t("step_selfie"),
  ];

  return (
    <Screen>
      <ScreenHeader title={t("title")} subtitle={t("body")} />
      <ScreenBody>
        <ul className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li
              key={i}
              className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-[0_4px_16px_rgba(74,44,53,0.04)]"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-semibold"
                style={{
                  backgroundColor: "var(--color-blush)",
                  color: "var(--color-brand-deep)",
                }}
              >
                {i + 1}
              </span>
              <span className="text-[15px] leading-relaxed text-[--color-plum]">
                {s}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-2xl border border-[--color-brand-border] bg-[--color-blush] px-4 py-3 text-center text-xs leading-relaxed text-[--color-brand-deep]">
          Ваши документы видит только наша команда модерации.
        </p>
      </ScreenBody>
      <ScreenFooter>
        <form action={next}>
          <PrimaryButton type="submit">{tc("continue")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
