import { setRequestLocale } from "next-intl/server";
import { Screen, ScreenBody } from "@/components/ui/screen";

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Screen>
      <ScreenBody>
        <div className="mt-12 flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: "var(--color-blush)",
              color: "var(--color-brand-deep)",
            }}
            aria-hidden
          >
            🔧
          </div>
          <h1 className="mt-7 text-[28px] font-semibold leading-tight tracking-tight text-[--color-plum]">
            Технические работы
          </h1>
          <p className="mt-3 max-w-[320px] text-[15px] leading-relaxed text-[--color-ink-2]">
            Обновляем приложение. Мы вернёмся через несколько минут — спасибо за терпение.
          </p>
        </div>
      </ScreenBody>
    </Screen>
  );
}
