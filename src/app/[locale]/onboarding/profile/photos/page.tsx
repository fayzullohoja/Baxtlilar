import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, PrimaryButton } from "@/components/ui/screen";
import { Field, RadioList } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadProfilePhoto, deletePhoto, getSignedPhotoUrl } from "@/lib/uploads/photos";
import { PhotoSlot } from "./client";
import { revalidatePath } from "next/cache";

const MAX_PHOTOS = 4;

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const tDoc = await getTranslations("document");
  const user = await requireUser(locale);

  const { data: photos } = await supabaseAdmin
    .from("profile_photos")
    .select("id, storage_path, is_main, position")
    .eq("user_id", user.id)
    .order("is_main", { ascending: false })
    .order("position", { ascending: true });

  const photoList = photos ?? [];
  const main = photoList.find((p) => p.is_main);
  const extras = photoList.filter((p) => !p.is_main).slice(0, MAX_PHOTOS);

  // pre-sign URLs for preview
  const mainUrl = main ? await getSignedPhotoUrl(main.storage_path) : null;
  const extraSigned = await Promise.all(
    extras.map(async (e) => ({
      ...e,
      url: await getSignedPhotoUrl(e.storage_path),
    })),
  );

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("photo_privacy_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  async function uploadMain(formData: FormData) {
    "use server";
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return;
    await uploadProfilePhoto(user.id, file, true, 0);
    revalidatePath(`/${locale}${ONBOARDING_PATHS.profile_photos}`);
  }

  async function uploadExtra(formData: FormData) {
    "use server";
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return;
    const position = Number(formData.get("position") ?? 0);
    await uploadProfilePhoto(user.id, file, false, position);
    revalidatePath(`/${locale}${ONBOARDING_PATHS.profile_photos}`);
  }

  async function removePhoto(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    await deletePhoto(user.id, id);
    revalidatePath(`/${locale}${ONBOARDING_PATHS.profile_photos}`);
  }

  async function next(formData: FormData) {
    "use server";
    const privacy = String(formData.get("photo_privacy_mode") ?? "public_verified_users");
    if (!main) {
      redirect(`/${locale}${ONBOARDING_PATHS.profile_photos}?error=no_main`);
    }
    await supabaseAdmin
      .from("user_profiles")
      .upsert(
        { user_id: user.id, photo_privacy_mode: privacy },
        { onConflict: "user_id" },
      );
    await transition(user.id, { onboarding_step: "profile_education" }, "profile photos");
    redirect(`/${locale}${ONBOARDING_PATHS.profile_education}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("photos_title")} subtitle={t("photos_body")} />
      <ScreenBody>
        <div className="space-y-5">
          <Field label={t("main_photo")}>
            <PhotoSlot
              previewUrl={mainUrl}
              uploadAction={uploadMain}
              removeAction={main ? (fd) => removePhoto(fd) : null}
              photoId={main?.id ?? null}
              labels={{
                pick: tDoc("pick"),
                use: tDoc("use"),
                retake: tDoc("retake"),
                uploading: tDoc("uploading"),
                error: tDoc("upload_error"),
              }}
            />
          </Field>

          <Field label={t("extra_photos")}>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                const existing = extraSigned[i];
                return (
                  <PhotoSlot
                    key={i}
                    compact
                    position={i + 1}
                    previewUrl={existing?.url ?? null}
                    uploadAction={uploadExtra}
                    removeAction={existing ? removePhoto : null}
                    photoId={existing?.id ?? null}
                    labels={{
                      pick: "+",
                      use: tDoc("use"),
                      retake: tDoc("retake"),
                      uploading: tDoc("uploading"),
                      error: tDoc("upload_error"),
                    }}
                  />
                );
              })}
            </div>
          </Field>

          <form action={next} className="flex flex-col gap-3">
            <Field label={t("privacy_label")}>
              <RadioList
                name="photo_privacy_mode"
                defaultValue={profile?.photo_privacy_mode ?? "public_verified_users"}
                options={[
                  { value: "public_verified_users", label: t("privacy_public") },
                  { value: "blur_until_match", label: t("privacy_blur") },
                  { value: "hidden_until_match", label: t("privacy_hidden") },
                ]}
              />
            </Field>
            <PrimaryButton type="submit" disabled={!main}>
              {tc("continue")}
            </PrimaryButton>
            {!main ? (
              <p className="text-center text-xs text-neutral-500">
                Сначала загрузите главное фото
              </p>
            ) : null}
          </form>
        </div>
      </ScreenBody>
    </Screen>
  );
}
