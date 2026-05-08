import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody } from "@/components/ui/screen";
import { requireUserAtStep } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { uploadPassport } from "@/lib/uploads/documents";
import { PhotoUploader } from "@/components/photo-uploader";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("document");
  const user = await requireUserAtStep(locale, "document_upload");

  const errMsg =
    error === "empty"
      ? "Прикрепите фото паспорта"
      : error === "mime"
        ? "Неверный формат. Поддерживается JPG, PNG, HEIC, WebP."
        : error === "size"
          ? "Файл слишком большой. Максимум 10 МБ."
          : error === "upload"
            ? "Не удалось загрузить файл. Попробуйте снова."
            : null;

  async function upload(formData: FormData) {
    "use server";
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      redirect(`/${locale}${ONBOARDING_PATHS.document_upload}?error=empty`);
    }
    try {
      await uploadPassport(user.id, file!);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const code = msg.includes("Unsupported")
        ? "mime"
        : msg.includes("too large")
          ? "size"
          : "upload";
      redirect(`/${locale}${ONBOARDING_PATHS.document_upload}?error=${code}`);
    }
    await transition(
      user.id,
      {
        verification_status: "documents_uploaded",
        onboarding_step: "liveness_upload",
      },
      "passport uploaded",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.liveness_upload}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("title")} subtitle={t("body")} />
      <ScreenBody>
        {errMsg ? (
          <p className="mb-4 rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-sm text-[--color-danger]">
            {errMsg}
          </p>
        ) : null}
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
            pick: t("pick"),
            use: t("use"),
            retake: t("retake"),
            uploading: t("uploading"),
            error: t("upload_error"),
          }}
          captureMode="environment"
        />
      </ScreenBody>
    </Screen>
  );
}
