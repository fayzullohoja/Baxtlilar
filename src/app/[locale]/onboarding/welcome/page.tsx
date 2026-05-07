import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenBody, ScreenFooter } from "@/components/ui/screen";
import { bootstrapFromTelegram } from "@/lib/auth/bootstrap";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "@/lib/state-machine/router";
import { WelcomeBootstrap } from "./client";

export default async function WelcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("welcome");

  const errMsg =
    error === "no_tg"
      ? "Открой эту страницу через Telegram (через бота @baxtlilar_uz_bot), либо включи DEV_BYPASS_TG=1 в env."
      : error === "bootstrap"
        ? "Не удалось создать пользователя. Попробуй ещё раз или проверь логи."
        : null;

  async function start(initData?: string) {
    "use server";
    try {
      await bootstrapFromTelegram(initData);
    } catch (e) {
      // Most common: opened in plain browser without Telegram initData and
      // DEV_BYPASS_TG=0. Redirect with a hint instead of bubbling a 500.
      const reason =
        e instanceof Error && e.message.includes("Invalid Telegram") ? "no_tg" : "bootstrap";
      redirect(`/${locale}/onboarding/welcome?error=${reason}`);
    }
    const user = await getCurrentUser();
    if (!user) redirect(`/${locale}/onboarding/welcome?error=bootstrap`);
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
        {errMsg ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-900">
            {errMsg}
          </p>
        ) : null}
        <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
          {t("footer")}
        </p>
      </ScreenFooter>
    </Screen>
  );
}
