import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";

export default async function ModerationRejectedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("moderation");
  const user = await requireUser(locale);

  const { data: doc } = await supabaseAdmin
    .from("user_documents")
    .select("rejection_reason, rejection_kind")
    .eq("user_id", user.id)
    .maybeSingle();

  async function retry() {
    "use server";
    const target = doc?.rejection_kind === "selfie" ? "liveness_upload" : "document_upload";
    await transition(
      user.id,
      { onboarding_step: target, verification_status: "phone_verified" },
      "user retries verification",
    );
    redirect(`/${locale}${ONBOARDING_PATHS[target]}`);
  }

  return (
    <Screen>
      <ScreenBody>
        <div className="mt-6 flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: "var(--color-warn-bg)",
              color: "var(--color-warn)",
            }}
            aria-hidden
          >
            ↻
          </div>
          <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-tight text-[--color-plum]">
            {t("rejected_title")}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[--color-ink-2]">
            {t("rejected_body")}
          </p>
        </div>
        {doc?.rejection_reason ? (
          <div
            className="mt-7 rounded-3xl border px-5 py-4 text-sm leading-relaxed"
            style={{
              backgroundColor: "var(--color-warn-bg)",
              borderColor: "var(--color-warn)",
              color: "var(--color-warn)",
            }}
          >
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider">
              Что нужно исправить
            </p>
            {doc.rejection_reason}
          </div>
        ) : null}
      </ScreenBody>
      <ScreenFooter>
        <form action={retry}>
          <PrimaryButton type="submit">{t("rejected_retry")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
