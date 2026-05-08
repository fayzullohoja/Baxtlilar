import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, PrimaryButton } from "@/components/ui/screen";
import { Field, RadioList, CheckboxList } from "@/components/ui/form";
import { requireUserAtStep } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { valuesSchema } from "@/lib/profile/schemas";
import { RELIGIOSITY, SMOKING, ALCOHOL, INTERESTS } from "@/lib/profile/options";

export default async function ValuesPage({
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
  const user = await requireUserAtStep(locale, "profile_values");
  const lang = locale as "ru" | "uz";

  const { data: existing } = await supabaseAdmin
    .from("user_profiles")
    .select("religiosity_level, smoking_status, alcohol_status, interests")
    .eq("user_id", user.id)
    .maybeSingle();

  async function save(formData: FormData) {
    "use server";
    const parsed = valuesSchema.safeParse({
      religiosity_level: formData.get("religiosity_level"),
      smoking_status: formData.get("smoking_status"),
      alcohol_status: formData.get("alcohol_status"),
      interests: formData.getAll("interests").map(String),
    });
    if (!parsed.success) {
      redirect(`/${locale}${ONBOARDING_PATHS.profile_values}?error=invalid`);
    }
    await supabaseAdmin.from("user_profiles").upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
    await transition(user.id, { onboarding_step: "profile_looking_for" }, "profile values");
    redirect(`/${locale}${ONBOARDING_PATHS.profile_looking_for}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("values_title")} />
      <ScreenBody>
        <form action={save} className="flex flex-col gap-4">
          {error === "invalid" ? (
            <p className="rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-sm text-[--color-danger]">
              Выберите ответ в каждом разделе. Минимум 1 интерес — максимум 5.
            </p>
          ) : null}
          <Field label={t("religiosity")}>
            <RadioList
              name="religiosity_level"
              defaultValue={existing?.religiosity_level}
              options={RELIGIOSITY.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("smoking")}>
            <RadioList
              name="smoking_status"
              defaultValue={existing?.smoking_status}
              options={SMOKING.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("alcohol")}>
            <RadioList
              name="alcohol_status"
              defaultValue={existing?.alcohol_status}
              options={ALCOHOL.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("interests")}>
            <CheckboxList
              name="interests"
              defaultValue={existing?.interests ?? []}
              min={1}
              max={5}
              options={INTERESTS.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <PrimaryButton type="submit">{tc("continue")}</PrimaryButton>
        </form>
      </ScreenBody>
    </Screen>
  );
}
