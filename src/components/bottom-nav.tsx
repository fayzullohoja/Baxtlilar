import Link from "next/link";
import { getTranslations } from "next-intl/server";

export type NavTab = "main" | "requests" | "chats" | "settings";

export async function BottomNav({
  locale,
  active,
  badges,
}: {
  locale: string;
  active: NavTab;
  badges?: Partial<Record<NavTab, number>>;
}) {
  const t = await getTranslations({ locale, namespace: "nav" });
  const items: Array<{ key: NavTab; href: string; label: string; icon: string }> = [
    { key: "main", href: `/${locale}/main`, label: t("feed"), icon: "🌸" },
    { key: "requests", href: `/${locale}/requests`, label: t("requests"), icon: "✉️" },
    { key: "chats", href: `/${locale}/chats`, label: t("chats"), icon: "💬" },
    { key: "settings", href: `/${locale}/settings`, label: t("profile"), icon: "👤" },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md justify-around border-t bg-white/95 px-2 py-2 backdrop-blur"
      style={{ borderColor: "var(--color-line)" }}
    >
      {items.map((it) => {
        const count = badges?.[it.key] ?? 0;
        const isActive = it.key === active;
        return (
          <Link
            key={it.key}
            href={it.href}
            className={`relative flex flex-1 flex-col items-center rounded-xl px-2 py-1 text-xs ${
              isActive
                ? "font-semibold text-[--color-brand-deep]"
                : "text-[--color-plum-mute]"
            }`}
          >
            <span className="text-lg" aria-hidden>
              {it.icon}
            </span>
            <span className="mt-0.5">{it.label}</span>
            {count > 0 ? (
              <span
                className="absolute right-3 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: "var(--color-brand-deep)" }}
              >
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
