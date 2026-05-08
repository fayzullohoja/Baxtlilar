import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenBody, ScreenFooter } from "@/components/ui/screen";
import { Logo } from "@/components/brand/logo";
import { bootstrapFromTelegram } from "@/lib/auth/bootstrap";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isBootstrapAllowed, recordBootstrap } from "@/lib/auth/bootstrap-throttle";
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

  // If user already has a session, send them to their actual step instead
  // of showing welcome again. Don't redirect when there's an error param —
  // we want to show the error message on this page.
  if (!error) {
    const existing = await getCurrentUser();
    if (existing) {
      redirect(`/${locale}${nextScreenFor(existing)}`);
    }
  }

  const botUsername = process.env.BOT_USERNAME ?? "baxtlilar_uz_bot";
  const errMsg =
    error === "no_tg"
      ? `Откройте приложение через Telegram (бот @${botUsername}).`
      : error === "bootstrap"
        ? "Не удалось создать аккаунт. Попробуйте ещё раз."
        : error === "rate_limit"
          ? "Слишком много попыток. Подождите час и попробуйте снова."
          : null;

  async function start(initData?: string) {
    "use server";
    if (!(await isBootstrapAllowed())) {
      redirect(`/${locale}/onboarding/welcome?error=rate_limit`);
    }
    try {
      await bootstrapFromTelegram(initData);
    } catch (e) {
      const reason =
        e instanceof Error && e.message.includes("Invalid Telegram") ? "no_tg" : "bootstrap";
      redirect(`/${locale}/onboarding/welcome?error=${reason}`);
    }
    await recordBootstrap();
    const user = await getCurrentUser();
    if (!user) redirect(`/${locale}/onboarding/welcome?error=bootstrap`);
    redirect(`/${locale}${nextScreenFor(user)}`);
  }

  return (
    <Screen>
      <ScreenBody>
        <div className="mt-12 flex flex-col items-center text-center">
          <span style={{ color: "var(--color-brand)" }}>
            <Logo size={92} />
          </span>
          <h1 className="mt-7 text-[34px] font-bold leading-tight tracking-tight text-[--color-plum]">
            {t("title")}
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-[--color-ink-2]">
            {t("subtitle")}
          </p>
          <p className="mt-8 max-w-[300px] text-[14px] leading-relaxed text-[--color-plum-mute]">
            {t("body")}
          </p>
          <ul className="mt-8 flex w-full flex-col gap-2.5">
            {[
              "Проверенные анкеты",
              "Уважительное общение",
              "Серьёзные намерения",
            ].map((s) => (
              <li
                key={s}
                className="flex items-center gap-3 rounded-2xl bg-[--color-blush] px-4 py-3 text-[14px] text-[--color-plum]"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: "var(--color-brand)" }}
                  aria-hidden
                >
                  ✓
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </ScreenBody>
      <ScreenFooter>
        <WelcomeBootstrap startAction={start} startLabel={t("start")} />
        {errMsg ? (
          <p className="rounded-2xl border border-[--color-warn] bg-[--color-warn-bg] p-3 text-center text-xs leading-relaxed text-[--color-warn]">
            {errMsg}
          </p>
        ) : null}
        <p className="mt-2 text-center text-[11px] leading-relaxed text-[--color-ink-muted]">
          {t("footer")}
        </p>
      </ScreenFooter>
    </Screen>
  );
}
