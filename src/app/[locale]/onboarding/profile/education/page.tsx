import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, PrimaryButton } from "@/components/ui/screen";
import { Field, RadioList, Select, TextInput } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { educationSchema } from "@/lib/profile/schemas";
import { EDUCATION_LEVELS, WORK_INDUSTRIES, EMPLOYMENT_STATUSES, FINANCIAL_STABILITY } from "@/lib/profile/options";

export default async function EducationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const user = await requireUser(locale);
  const lang = locale as "ru" | "uz";

  const { data: existing } = await supabaseAdmin
    .from("user_profiles")
    .select("education_level, work_industry, profession, employment_status, financial_stability")
    .eq("user_id", user.id)
    .maybeSingle();

  async function save(formData: FormData) {
    "use server";
    const parsed = educationSchema.safeParse({
      education_level: formData.get("education_level"),
      work_industry: formData.get("work_industry"),
      profession: formData.get("profession") ?? "",
      employment_status: formData.get("employment_status"),
      financial_stability: formData.get("financial_stability"),
    });
    if (!parsed.success) {
      redirect(`/${locale}${ONBOARDING_PATHS.profile_education}?error=invalid`);
    }
    await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: user.id, ...parsed.data, profession: parsed.data.profession || null }, { onConflict: "user_id" });
    await transition(user.id, { onboarding_step: "profile_family" }, "profile education");
    redirect(`/${locale}${ONBOARDING_PATHS.profile_family}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("education_title")} />
      <ScreenBody>
        <form action={save} className="flex flex-col gap-4">
          <Field label={t("education_level")}>
            <Select name="education_level" defaultValue={existing?.education_level ?? ""} required>
              <option value="" disabled>—</option>
              {EDUCATION_LEVELS.map((o) => (
                <option key={o.id} value={o.id}>{o[lang]}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("work_industry")}>
            <Select name="work_industry" defaultValue={existing?.work_industry ?? ""} required>
              <option value="" disabled>—</option>
              {WORK_INDUSTRIES.map((o) => (
                <option key={o.id} value={o.id}>{o[lang]}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("profession")}>
            <TextInput name="profession" defaultValue={existing?.profession ?? ""} maxLength={100} />
          </Field>
          <Field label={t("employment_status")}>
            <RadioList
              name="employment_status"
              defaultValue={existing?.employment_status ?? null}
              options={EMPLOYMENT_STATUSES.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("financial_stability")}>
            <RadioList
              name="financial_stability"
              defaultValue={existing?.financial_stability ?? null}
              options={FINANCIAL_STABILITY.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <PrimaryButton type="submit">{tc("continue")}</PrimaryButton>
        </form>
      </ScreenBody>
    </Screen>
  );
}
