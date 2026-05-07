import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { sendOtp } from "@/lib/otp/service";

const UZ_PHONE = /^\+998\d{9}$/;

export default async function PhonePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("phone");
  const tCommon = await getTranslations("common");
  const user = await requireUser(locale);

  async function submit(formData: FormData) {
    "use server";
    const raw = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "");
    const phone = raw.startsWith("+") ? raw : `+998${raw.replace(/^998/, "")}`;
    if (!UZ_PHONE.test(phone)) {
      redirect(`/${locale}${ONBOARDING_PATHS.phone_input}?error=invalid`);
    }
    await transition(
      user.id,
      { phone_number: phone, onboarding_step: "otp_pending" },
      "phone submitted",
    );
    await sendOtp(user.id, phone);
    redirect(`/${locale}${ONBOARDING_PATHS.otp_pending}`);
  }

  return (
    <Screen>
      <ScreenHeader title={t("title")} subtitle={t("body")} />
      <ScreenBody>
        <form action={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-700">
              {t("label")}
            </span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+998 XX XXX XX XX"
              defaultValue={user.phone_number ?? "+998"}
              className="h-12 rounded-xl border border-neutral-300 bg-white px-4 text-base focus:border-neutral-900 focus:outline-none"
              required
            />
          </label>
          <PrimaryButton type="submit">{t("submit")}</PrimaryButton>
        </form>
      </ScreenBody>
    </Screen>
  );
}
