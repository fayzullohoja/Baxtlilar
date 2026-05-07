import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { uploadSelfie } from "@/lib/uploads/documents";
import { PhotoUploader } from "@/components/photo-uploader";

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
    redirect(`/${locale}${ONBOARDING_PATHS.moderation_submitted}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("title")} subtitle={t("body")} />
      <ScreenBody>
        <ul className="mb-6 space-y-2 text-sm text-neutral-700">
          <li>• {t("tip_1")}</li>
          <li>• {t("tip_2")}</li>
          <li>• {t("tip_3")}</li>
          <li>• {t("tip_4")}</li>
        </ul>
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
