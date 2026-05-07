import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export default async function VerificationIntroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("verification_intro");
  const user = await requireUser(locale);

  async function next() {
    "use server";
    await transition(
      user.id,
      { onboarding_step: "document_upload" },
      "saw verification intro",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.document_upload}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("title")} subtitle={t("body")} />
      <ScreenBody>
        <p className="mb-3 text-sm font-medium text-neutral-700">{t("what")}</p>
        <ul className="flex flex-col gap-2">
          {[t("passport"), t("selfie"), t("review")].map((s, i) => (
            <li
              key={i}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-sm"
            >
              {i + 1}. {s}
            </li>
          ))}
        </ul>
      </ScreenBody>
      <ScreenFooter>
        <form action={next}>
          <PrimaryButton type="submit">{t("start")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
