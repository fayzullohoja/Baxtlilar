import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export default async function LanguagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("language");
  const user = await requireUser(locale);

  async function pick(formData: FormData) {
    "use server";
    const lang = formData.get("lang") as "ru" | "uz";
    if (lang !== "ru" && lang !== "uz") return;
    await transition(
      user.id,
      { language: lang, onboarding_step: "security_intro" },
      "user picked language",
    );
    redirect(`/${lang}${ONBOARDING_PATHS.security_intro}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("title")} />
      <ScreenBody>
        <form action={pick} className="flex flex-col gap-3">
          <button
            type="submit"
            name="lang"
            value="ru"
            className="h-14 w-full rounded-xl border border-neutral-300 bg-white text-base font-medium hover:border-neutral-900"
          >
            🇷🇺 {t("ru")}
          </button>
          <button
            type="submit"
            name="lang"
            value="uz"
            className="h-14 w-full rounded-xl border border-neutral-300 bg-white text-base font-medium hover:border-neutral-900"
          >
            🇺🇿 {t("uz")}
          </button>
        </form>
      </ScreenBody>
    </Screen>
  );
}
