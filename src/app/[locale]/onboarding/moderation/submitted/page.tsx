import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
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
      <ScreenHeader title={t("submitted_title")} subtitle={t("submitted_body")} />
      <ScreenBody>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          {t("submitted_eta")}
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
