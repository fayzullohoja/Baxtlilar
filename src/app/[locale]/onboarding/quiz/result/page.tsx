import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function QuizResultPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quiz");
  const user = await requireUser(locale);
  const { data: result } = await supabaseAdmin
    .from("quiz_results")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  async function done() {
    "use server";
    await transition(
      user.id,
      { lifecycle_state: "active", onboarding_step: "complete" },
      "onboarding complete",
    );
    redirect(`/${locale}/main`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("result_title")} />
      <ScreenBody>
        <div className="space-y-3 text-sm">
          <Row label={t("result_intention")} value={result?.intention_type ?? "—"} />
          <Row label={t("result_tempo")} value={result?.relationship_tempo ?? "—"} />
          <Row label={t("result_style")} value={result?.communication_style ?? "—"} />
          <Row
            label={t("result_values")}
            value={`${result?.family_values_score ?? 0} / 4`}
          />
          <Row label="Стиль конфликтов" value={result?.conflict_style ?? "—"} />
          <Row label="Приоритет matching" value={String(result?.match_priority_score ?? 0)} />
        </div>
      </ScreenBody>
      <ScreenFooter>
        <form action={done}>
          <PrimaryButton type="submit">{t("result_continue")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 font-medium">{String(value)}</p>
    </div>
  );
}
