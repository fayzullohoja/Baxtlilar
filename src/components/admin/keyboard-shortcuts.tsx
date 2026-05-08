"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface QueueShortcut {
  type: "queue";
  /** ordered list of detail-page hrefs in the visible queue */
  rows: string[];
}

interface DetailShortcut {
  type: "detail";
  /** href back to queue (used by Esc) */
  queueHref: string;
  /** href to next pending user, if any */
  nextHref: string | null;
  /** href to previous pending user, if any */
  prevHref: string | null;
}

export function KeyboardShortcuts(props: QueueShortcut | DetailShortcut) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    }

    function onKey(e: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (isTypingTarget(e.target)) return;
      // Ignore if any modifier key — let browser handle them
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();

      // Help overlay (works everywhere)
      if (k === "?" || (e.shiftKey && k === "/")) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (k === "escape" && helpOpen) {
        setHelpOpen(false);
        return;
      }

      if (props.type === "queue") {
        // J/K = down/up rows; Enter = open focused; we use a state-less
        // tracker via [data-queue-row][data-focused] pseudo-classes via CSS hash
        if (k === "j" || k === "k") {
          e.preventDefault();
          const next = moveFocus(props.rows, k === "j" ? 1 : -1);
          if (next) {
            const row = document.querySelector<HTMLElement>(
              `[data-queue-row="${next}"]`,
            );
            row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
          return;
        }
        if (k === "enter") {
          const focused = currentFocus();
          if (focused) {
            e.preventDefault();
            router.push(focused);
          }
          return;
        }
      } else {
        // detail page
        if (k === "escape") {
          e.preventDefault();
          router.push(props.queueHref);
          return;
        }
        if (k === "j" && props.nextHref) {
          e.preventDefault();
          router.push(props.nextHref);
          return;
        }
        if (k === "k" && props.prevHref) {
          e.preventDefault();
          router.push(props.prevHref);
          return;
        }
        if (k === "a") {
          // Confirm approve & next
          const btn = document.querySelector<HTMLButtonElement>(
            '[data-shortcut="approve-next"]',
          );
          if (btn) {
            e.preventDefault();
            btn.form?.requestSubmit();
          }
          return;
        }
        if (k === "r") {
          // Open reject disclosure if not open, else focus textarea
          const reject = document.querySelector<HTMLDetailsElement>(
            '[data-shortcut="reject-toggle"]',
          );
          if (reject) {
            e.preventDefault();
            reject.open = true;
            const ta = reject.querySelector<HTMLTextAreaElement>("textarea[name='reason']");
            ta?.focus();
          }
          return;
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props, router, helpOpen]);

  return (
    <>
      {/* Floating hint pill */}
      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-30 inline-flex h-8 items-center gap-1.5 rounded-full border border-[--admin-border] bg-white px-3 text-xs font-medium text-[--admin-text-2] shadow-[var(--admin-shadow)] transition hover:text-[--admin-text]"
        aria-label="Клавиатурные сокращения"
      >
        <kbd className="rounded border border-[--admin-border] bg-[--admin-surface-2] px-1 font-mono text-[10px]">
          ?
        </kbd>
        Хоткеи
      </button>

      {helpOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[--admin-border] px-5 py-3">
              <h2 className="text-sm font-semibold text-[--admin-text]">
                Клавиатурные сокращения
              </h2>
              <button
                onClick={() => setHelpOpen(false)}
                className="text-[--admin-text-muted] hover:text-[--admin-text]"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4">
              <ul className="flex flex-col gap-2 text-sm">
                {props.type === "queue" ? (
                  <>
                    <ShortcutRow keys={["J"]} desc="Следующая строка" />
                    <ShortcutRow keys={["K"]} desc="Предыдущая строка" />
                    <ShortcutRow keys={["Enter"]} desc="Открыть карточку" />
                  </>
                ) : (
                  <>
                    <ShortcutRow keys={["A"]} desc="Одобрить и следующий" />
                    <ShortcutRow keys={["R"]} desc="Открыть форму отклонения" />
                    <ShortcutRow keys={["J"]} desc="Следующая заявка" />
                    <ShortcutRow keys={["K"]} desc="Предыдущая заявка" />
                    <ShortcutRow keys={["Esc"]} desc="Назад в очередь" />
                  </>
                )}
                <ShortcutRow keys={["?"]} desc="Показать/скрыть эту панель" />
              </ul>
              <p className="mt-4 text-xs text-[--admin-text-muted]">
                Шорткаты не работают, когда фокус в поле ввода.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-[--admin-text-2]">{desc}</span>
      <span className="flex items-center gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-[--admin-border] bg-[--admin-surface-2] px-1.5 font-mono text-xs text-[--admin-text]"
          >
            {k}
          </kbd>
        ))}
      </span>
    </li>
  );
}

// ---- queue row focus tracking (lightweight, DOM-based) ----

let _focusedHref: string | null = null;

function currentFocus(): string | null {
  return _focusedHref;
}

function moveFocus(rows: string[], delta: number): string | null {
  if (rows.length === 0) return null;
  let idx = _focusedHref ? rows.indexOf(_focusedHref) : -1;
  idx = Math.max(0, Math.min(rows.length - 1, idx + delta));
  if (idx < 0) idx = 0;
  // Clear old visual marker
  document
    .querySelectorAll<HTMLElement>("[data-queue-row][data-focused]")
    .forEach((el) => el.removeAttribute("data-focused"));
  const next = rows[idx];
  _focusedHref = next ?? null;
  if (next) {
    const el = document.querySelector<HTMLElement>(`[data-queue-row="${next}"]`);
    el?.setAttribute("data-focused", "true");
  }
  return next ?? null;
}
