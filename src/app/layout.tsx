import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bakhtlilar — серьёзные знакомства",
    template: "%s · Bakhtlilar",
  },
  description:
    "Telegram Mini App для серьёзных знакомств в Узбекистане. Проверенные анкеты, уважительное общение, серьёзные намерения.",
  applicationName: "Bakhtlilar",
  authors: [{ name: "Bakhtlilar team" }],
  keywords: [
    "знакомства",
    "никох",
    "узбекистан",
    "ташкент",
    "telegram mini app",
  ],
  openGraph: {
    type: "website",
    title: "Bakhtlilar",
    description: "Серьёзные знакомства с проверкой профилей",
    locale: "ru_RU",
    alternateLocale: ["uz_UZ"],
    siteName: "Bakhtlilar",
  },
  twitter: {
    card: "summary",
    title: "Bakhtlilar",
    description: "Серьёзные знакомства с проверкой профилей",
  },
  robots: {
    // Mini App is for Telegram users, not search engines
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ff6f91",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-dvh antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
