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
        <ul className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-[0_4px_16px_rgba(74,44,53,0.04)]"
            >
              <span className="flex items-center gap-3 text-[15px] text-[--color-plum]">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={
                    s.done
                      ? {
                          backgroundColor: "var(--color-success-bg)",
                          color: "var(--color-success)",
                        }
                      : {
                          backgroundColor: "var(--color-blush)",
                          color: "var(--color-brand-deep)",
                        }
                  }
                  aria-hidden
                >
                  {s.done ? "✓" : i + 1}
                </span>
                {s.label}
              </span>
              <span
                className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={
                  s.done
                    ? {
                        backgroundColor: "var(--color-success-bg)",
                        color: "var(--color-success)",
                      }
                    : {
                        backgroundColor: "var(--color-warn-bg)",
                        color: "var(--color-warn)",
                      }
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
