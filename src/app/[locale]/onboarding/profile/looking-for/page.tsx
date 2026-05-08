import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, PrimaryButton } from "@/components/ui/screen";
import { Field, RadioList, CheckboxList, TextInput } from "@/components/ui/form";
import { requireUserAtStep } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { lookingForSchema } from "@/lib/profile/schemas";
import { LOOKING_CITY_SCOPE, LOOKING_MARITAL, LOOKING_CHILDREN, PARTNER_QUALITIES } from "@/lib/profile/options";

export default async function LookingForPage({
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
  const user = await requireUserAtStep(locale, "profile_looking_for");
  const lang = locale as "ru" | "uz";

  const { data: existing } = await supabaseAdmin
    .from("user_profiles")
    .select(
      "looking_for_gender, preferred_age_min, preferred_age_max, preferred_city_scope, preferred_marital_status, preferred_children_status, preferred_partner_qualities",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  async function save(formData: FormData) {
    "use server";
    const parsed = lookingForSchema.safeParse({
      looking_for_gender: formData.get("looking_for_gender"),
      preferred_age_min: formData.get("preferred_age_min"),
      preferred_age_max: formData.get("preferred_age_max"),
      preferred_city_scope: formData.get("preferred_city_scope"),
      preferred_marital_status: formData.get("preferred_marital_status"),
      preferred_children_status: formData.get("preferred_children_status"),
      preferred_partner_qualities: formData.getAll("preferred_partner_qualities").map(String),
    });
    if (!parsed.success) {
      redirect(`/${locale}${ONBOARDING_PATHS.profile_looking_for}?error=invalid`);
    }
    await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
    await transition(user.id, { onboarding_step: "profile_about" }, "profile looking_for");
    redirect(`/${locale}${ONBOARDING_PATHS.profile_about}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("looking_title")} />
      <ScreenBody>
        <form action={save} className="flex flex-col gap-4">
          {error === "invalid" ? (
            <p className="rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-sm text-[--color-danger]">
              Заполните все поля. Возрастной диапазон 18–80, минимум 3 качества партнёра (макс. 5).
            </p>
          ) : null}
          <Field label={t("looking_gender")}>
            <RadioList
              name="looking_for_gender"
              defaultValue={existing?.looking_for_gender ?? null}
              options={[
                { value: "male", label: t("gender_male") },
                { value: "female", label: t("gender_female") },
              ]}
            />
          </Field>
          <Field label={t("looking_age")}>
            <div className="flex items-center gap-2">
              <TextInput
                name="preferred_age_min"
                type="number"
                min={18}
                max={80}
                defaultValue={existing?.preferred_age_min ?? 25}
                required
                className="w-full"
              />
              <span className="text-sm text-[--color-ink-muted]">—</span>
              <TextInput
                name="preferred_age_max"
                type="number"
                min={18}
                max={80}
                defaultValue={existing?.preferred_age_max ?? 40}
                required
                className="w-full"
              />
            </div>
          </Field>
          <Field label={t("looking_city")}>
            <RadioList
              name="preferred_city_scope"
              defaultValue={existing?.preferred_city_scope}
              options={LOOKING_CITY_SCOPE.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("looking_marital")}>
            <RadioList
              name="preferred_marital_status"
              defaultValue={existing?.preferred_marital_status}
              options={LOOKING_MARITAL.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("looking_children")}>
            <RadioList
              name="preferred_children_status"
              defaultValue={existing?.preferred_children_status}
              options={LOOKING_CHILDREN.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("looking_qualities")}>
            <CheckboxList
              name="preferred_partner_qualities"
              defaultValue={existing?.preferred_partner_qualities ?? []}
              min={3}
              max={5}
              options={PARTNER_QUALITIES.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <PrimaryButton type="submit">{tc("continue")}</PrimaryButton>
        </form>
      </ScreenBody>
    </Screen>
  );
}
