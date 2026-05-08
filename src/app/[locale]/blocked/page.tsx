import { setRequestLocale, getTranslations } from "next-intl/server";
import { Screen, ScreenBody, ScreenFooter, SecondaryButton } from "@/components/ui/screen";

export default async function BlockedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blocked");

  return (
    <Screen>
      <ScreenBody>
        <div className="mt-8 flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: "var(--color-danger-bg)",
              color: "var(--color-danger)",
            }}
            aria-hidden
          >
            ✕
          </div>
          <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight text-[--color-plum]">
            {t("title")}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[--color-ink-2]">
            {t("body")}
          </p>
        </div>
      </ScreenBody>
      <ScreenFooter>
        <SecondaryButton disabled>{t("support")}</SecondaryButton>
        <SecondaryButton disabled>{t("rules")}</SecondaryButton>
      </ScreenFooter>
    </Screen>
  );
}
