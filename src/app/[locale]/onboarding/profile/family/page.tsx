import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, PrimaryButton } from "@/components/ui/screen";
import { Field, RadioList } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { familySchema } from "@/lib/profile/schemas";
import { HAS_CHILDREN, WANTS_CHILDREN, MARRIAGE_TIMELINE, RELOCATION } from "@/lib/profile/options";

export default async function FamilyPage({
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
    .select("has_children, wants_children, marriage_timeline, relocation_readiness")
    .eq("user_id", user.id)
    .maybeSingle();

  async function save(formData: FormData) {
    "use server";
    const parsed = familySchema.safeParse({
      has_children: formData.get("has_children"),
      wants_children: formData.get("wants_children"),
      marriage_timeline: formData.get("marriage_timeline"),
      relocation_readiness: formData.get("relocation_readiness"),
    });
    if (!parsed.success) {
      redirect(`/${locale}${ONBOARDING_PATHS.profile_family}?error=invalid`);
    }
    await supabaseAdmin.from("user_profiles").upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
    await transition(user.id, { onboarding_step: "profile_values" }, "profile family");
    redirect(`/${locale}${ONBOARDING_PATHS.profile_values}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("family_title")} />
      <ScreenBody>
        <form action={save} className="flex flex-col gap-4">
          <Field label={t("has_children")}>
            <RadioList
              name="has_children"
              defaultValue={existing?.has_children}
              options={HAS_CHILDREN.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("wants_children")}>
            <RadioList
              name="wants_children"
              defaultValue={existing?.wants_children}
              options={WANTS_CHILDREN.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("marriage_timeline")}>
            <RadioList
              name="marriage_timeline"
              defaultValue={existing?.marriage_timeline}
              options={MARRIAGE_TIMELINE.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <Field label={t("relocation")}>
            <RadioList
              name="relocation_readiness"
              defaultValue={existing?.relocation_readiness}
              options={RELOCATION.map((o) => ({ value: o.id, label: o[lang] }))}
            />
          </Field>
          <PrimaryButton type="submit">{tc("continue")}</PrimaryButton>
        </form>
      </ScreenBody>
    </Screen>
  );
}
