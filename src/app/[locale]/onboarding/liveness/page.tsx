import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { uploadSelfie } from "@/lib/uploads/documents";
import { PhotoUploader } from "@/components/photo-uploader";
import { notifyAdminTelegram, buildSubmissionMessage } from "@/lib/admin/notify";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function LivenessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("liveness");
  const tDoc = await getTranslations("document");
  const user = await requireUser(locale);

  async function upload(formData: FormData) {
    "use server";
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      redirect(`/${locale}${ONBOARDING_PATHS.liveness_upload}?error=empty`);
    }
    await uploadSelfie(user.id, file!);
    await transition(
      user.id,
      {
        verification_status: "pending_review",
        onboarding_step: "moderation_submitted",
      },
      "selfie uploaded — moderation pending",
    );

    // Fire-and-forget admin notification (no await — keeps user flow snappy)
    void (async () => {
      try {
        const [{ count }, { data: meta }] = await Promise.all([
          supabaseAdmin
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("verification_status", "pending_review"),
          supabaseAdmin
            .from("users")
            .select("telegram_first_name, telegram_username")
            .eq("id", user.id)
            .maybeSingle(),
        ]);
        await notifyAdminTelegram(
          buildSubmissionMessage({
            userId: user.id,
            name: meta?.telegram_first_name ?? null,
            username: meta?.telegram_username ?? null,
            telegramId: user.telegram_id,
            queueLength: count ?? 0,
            appUrl: process.env.APP_URL,
          }),
        );
      } catch (e) {
        console.warn("[notify-admin] failed:", e instanceof Error ? e.message : e);
      }
    })();

    redirect(`/${locale}${ONBOARDING_PATHS.moderation_submitted}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("title")} subtitle={t("body")} />
      <ScreenBody>
        <div
          className="mb-5 rounded-2xl px-4 py-3"
          style={{ backgroundColor: "var(--color-blush-soft)" }}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--color-brand-deep]">
            Советы
          </p>
          <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-[--color-plum-soft]">
            <li>· {t("tip_1")}</li>
            <li>· {t("tip_2")}</li>
            <li>· {t("tip_3")}</li>
            <li>· {t("tip_4")}</li>
          </ul>
        </div>
        <PhotoUploader
          uploadAction={upload}
          labels={{
            pick: tDoc("pick"),
            use: tDoc("use"),
            retake: tDoc("retake"),
            uploading: tDoc("uploading"),
            error: tDoc("upload_error"),
          }}
          captureMode="user"
        />
      </ScreenBody>
    </Screen>
  );
}
