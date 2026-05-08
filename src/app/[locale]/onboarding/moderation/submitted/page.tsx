import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export default async function ModerationSubmittedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("moderation");
  const tc = await getTranslations("common");
  const user = await requireUser(locale);

  async function ack() {
    "use server";
    await transition(
      user.id,
      { onboarding_step: "moderation_pending" },
      "ack moderation submitted",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.moderation_pending}`);
  }

  return (
    <Screen>
      <ScreenBody>
        <div className="mt-6 flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: "var(--color-blush)",
              color: "var(--color-brand-deep)",
            }}
            aria-hidden
          >
            ✓
          </div>
          <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight text-[--color-plum]">
            {t("submitted_title")}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[--color-ink-2]">
            {t("submitted_body")}
          </p>
          <div
            className="mt-7 w-full rounded-3xl border border-[--color-brand-border] px-5 py-4 text-sm leading-relaxed text-[--color-brand-deep]"
            style={{ backgroundColor: "var(--color-blush)" }}
          >
            {t("submitted_eta")}
          </div>
        </div>
      </ScreenBody>
      <ScreenFooter>
        <form action={ack}>
          <PrimaryButton type="submit">{tc("got_it")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
