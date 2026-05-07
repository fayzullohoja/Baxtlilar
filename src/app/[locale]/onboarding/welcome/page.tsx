import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton, SecondaryButton } from "@/components/ui/screen";
import { bootstrapFromTelegram } from "@/lib/auth/bootstrap";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "@/lib/state-machine/router";
import { WelcomeBootstrap } from "./client";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("welcome");

  async function start(initData?: string) {
    "use server";
    await bootstrapFromTelegram(initData);
    const user = await getCurrentUser();
    if (!user) throw new Error("Failed to bootstrap user");
    redirect(`/${locale}${nextScreenFor(user)}`);
  }

  return (
    <Screen>
      <ScreenBody>
        <div className="mt-8 flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-3 text-base text-neutral-600">{t("subtitle")}</p>
          <p className="mt-6 text-sm text-neutral-700">{t("body")}</p>
        </div>
      </ScreenBody>
      <ScreenFooter>
        <WelcomeBootstrap startAction={start} startLabel={t("start")} />
        <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
          {t("footer")}
        </p>
      </ScreenFooter>
    </Screen>
  );
}
