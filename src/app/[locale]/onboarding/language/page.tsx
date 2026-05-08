import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody } from "@/components/ui/screen";
import { requireUserAtStep } from "@/lib/auth/current-user";
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
  const user = await requireUserAtStep(locale, "language");

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
      <ScreenHeader
        title={t("title")}
        subtitle="Выберите язык приложения. Можно поменять позже."
      />
      <ScreenBody>
        <form action={pick} className="flex flex-col gap-3">
          {[
            { v: "ru", flag: "🇷🇺", label: t("ru") },
            { v: "uz", flag: "🇺🇿", label: t("uz") },
          ].map(({ v, flag, label }) => (
            <button
              key={v}
              type="submit"
              name="lang"
              value={v}
              className="group flex h-16 w-full items-center gap-4 rounded-3xl border border-[--color-line] bg-white px-5 text-left text-[15px] font-semibold text-[--color-plum] shadow-[0_4px_16px_rgba(74,44,53,0.04)] transition hover:border-[--color-brand-border] hover:shadow-[0_8px_24px_-8px_rgba(74,44,53,0.10)] active:scale-[.99]"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-2xl"
                style={{ backgroundColor: "var(--color-blush)" }}
                aria-hidden
              >
                {flag}
              </span>
              <span className="flex-1">{label}</span>
              <svg
                className="h-5 w-5 text-[--color-ink-muted] transition group-hover:translate-x-0.5 group-hover:text-[--color-brand]"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
              >
                <path
                  d="M7 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </form>
      </ScreenBody>
    </Screen>
  );
}
