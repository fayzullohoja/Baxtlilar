import { setRequestLocale, getTranslations } from "next-intl/server";
import { Screen, ScreenHeader, ScreenBody } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function MainPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("main");
  const user = await requireUser(locale);
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("telegram_first_name")
    .eq("id", user.id)
    .single();

  return (
    <Screen>
      <ScreenHeader
        title={t("greeting", { name: u?.telegram_first_name ?? "" })}
        subtitle={t("limit", { count: 2 })}
      />
      <ScreenBody>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t("todo")}
        </div>
      </ScreenBody>
    </Screen>
  );
}
