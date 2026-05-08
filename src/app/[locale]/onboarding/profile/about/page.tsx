import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, PrimaryButton } from "@/components/ui/screen";
import { Field, TextArea } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aboutSchema } from "@/lib/profile/schemas";

export default async function AboutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const user = await requireUser(locale);

  const { data: existing } = await supabaseAdmin
    .from("user_profiles")
    .select("about_me, marriage_values_text")
    .eq("user_id", user.id)
    .maybeSingle();

  async function save(formData: FormData) {
    "use server";
    const parsed = aboutSchema.safeParse({
      about_me: formData.get("about_me"),
      marriage_values_text: formData.get("marriage_values_text"),
    });
    if (!parsed.success) {
      redirect(`/${locale}${ONBOARDING_PATHS.profile_about}?error=invalid`);
    }
    await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
    await transition(user.id, { onboarding_step: "profile_preview" }, "profile about");
    redirect(`/${locale}${ONBOARDING_PATHS.profile_preview}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("about_title")} />
      <ScreenBody>
        <form action={save} className="flex flex-col gap-4">
          {error === "invalid" ? (
            <p className="rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-sm text-[--color-danger]">
              «О себе» должно быть 50–500 символов; «о ценностях» — 30–300.
            </p>
          ) : null}
          <Field label={t("about_me")} hint={t("about_me_hint") + " (50–500)"}>
            <TextArea
              name="about_me"
              defaultValue={existing?.about_me ?? ""}
              minLength={50}
              maxLength={500}
              required
            />
          </Field>
          <Field label={t("about_marriage")} hint={t("about_marriage_hint") + " (30–300)"}>
            <TextArea
              name="marriage_values_text"
              defaultValue={existing?.marriage_values_text ?? ""}
              minLength={30}
              maxLength={300}
              required
            />
          </Field>
          <PrimaryButton type="submit">{tc("continue")}</PrimaryButton>
        </form>
      </ScreenBody>
    </Screen>
  );
}
