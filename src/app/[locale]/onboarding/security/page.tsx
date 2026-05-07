import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
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
  const user = await requireUser(locale);

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
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <span className="text-sm">{s}</span>
            </li>
          ))}
        </ul>
      </ScreenBody>
      <ScreenFooter>
        <form action={next}>
          <PrimaryButton type="submit">{tc("continue")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
