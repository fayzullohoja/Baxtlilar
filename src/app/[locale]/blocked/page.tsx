import { setRequestLocale, getTranslations } from "next-intl/server";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, SecondaryButton } from "@/components/ui/screen";

export default async function BlockedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blocked");

  return (
    <Screen>
      <ScreenHeader title={t("title")} subtitle={t("body")} />
      <ScreenBody>
        <div className="flex h-32 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-3xl">
          🚫
        </div>
      </ScreenBody>
      <ScreenFooter>
        <SecondaryButton disabled>{t("support")}</SecondaryButton>
        <SecondaryButton disabled>{t("rules")}</SecondaryButton>
      </ScreenFooter>
    </Screen>
  );
}
