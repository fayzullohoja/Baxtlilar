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
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
          {t("what")}
        </p>
        <ul className="flex flex-col gap-3">
          {[t("passport"), t("selfie"), t("review")].map((s, i) => (
            <li
              key={i}
              className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-[0_4px_16px_rgba(74,44,53,0.04)]"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold"
                style={{
                  backgroundColor: "var(--color-blush)",
                  color: "var(--color-brand-deep)",
                }}
              >
                {i + 1}
              </span>
              <span className="text-[15px] leading-relaxed text-[--color-plum]">
                {s}
              </span>
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
