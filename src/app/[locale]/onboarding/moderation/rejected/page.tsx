import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton, SecondaryButton } from "@/components/ui/screen";
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
      <ScreenHeader title={t("rejected_title")} subtitle={t("rejected_body")} />
      <ScreenBody>
        {doc?.rejection_reason ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
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
