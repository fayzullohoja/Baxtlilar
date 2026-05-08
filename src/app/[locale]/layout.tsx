import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <div
        className="mx-auto flex min-h-dvh max-w-md flex-col"
        style={{
          backgroundColor: "var(--color-cream)",
          color: "var(--color-ink)",
        }}
        lang={locale}
      >
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
