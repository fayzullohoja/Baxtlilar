import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "@/lib/state-machine/router";

export default async function ModerationPendingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("moderation");
  await requireUser(locale);

  async function refresh() {
    "use server";
    revalidatePath(`/${locale}/onboarding/moderation/pending`);
    // re-fetch user state and route accordingly
    const fresh = await (await import("@/lib/auth/current-user")).getCurrentUser();
    if (fresh) redirect(`/${locale}${nextScreenFor(fresh)}`);
  }

  const steps = [
    { label: t("pending_step_phone"), done: true },
    { label: t("pending_step_passport"), done: true },
    { label: t("pending_step_selfie"), done: true },
    { label: t("pending_step_review"), done: false },
  ];

  return (
    <Screen>
      <ScreenHeader title={t("pending_title")} />
      <ScreenBody>
        <ul className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 text-sm"
            >
              <span>{s.label}</span>
              <span
                className={
                  s.done
                    ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                    : "rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600"
                }
              >
                {s.done ? t("pending_done") : t("pending_review_status")}
              </span>
            </li>
          ))}
        </ul>
      </ScreenBody>
      <ScreenFooter>
        <form action={refresh}>
          <PrimaryButton type="submit">{t("refresh")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
