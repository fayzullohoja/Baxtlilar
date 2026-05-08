"use client";

import { useEffect, useState } from "react";

export function ImageViewer({
  passportUrl,
  selfieUrl,
}: {
  passportUrl: string | null;
  selfieUrl: string | null;
}) {
  const [open, setOpen] = useState<"passport" | "selfie" | "compare" | null>(null);

  // Listen for clicks on images marked with data-zoom attribute
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const img = target.closest<HTMLElement>("[data-zoom]");
      if (!img) return;
      e.preventDefault();
      const kind = img.getAttribute("data-zoom") as "passport" | "selfie";
      setOpen(kind);
    }
    function onKey(e: KeyboardEvent) {
      if (open && e.key === "Escape") setOpen(null);
      if (open && e.key.toLowerCase() === "c" && passportUrl && selfieUrl) {
        setOpen("compare");
      }
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, passportUrl, selfieUrl]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
      onClick={() => setOpen(null)}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between border-b border-white/10 px-5 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => passportUrl && setOpen("passport")}
            disabled={!passportUrl}
            className={
              "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition " +
              (open === "passport"
                ? "bg-white text-[--admin-text]"
                : "bg-white/10 text-white hover:bg-white/20 disabled:opacity-40")
            }
          >
            Паспорт
          </button>
          <button
            type="button"
            onClick={() => selfieUrl && setOpen("selfie")}
            disabled={!selfieUrl}
            className={
              "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition " +
              (open === "selfie"
                ? "bg-white text-[--admin-text]"
                : "bg-white/10 text-white hover:bg-white/20 disabled:opacity-40")
            }
          >
            Selfie
          </button>
          {passportUrl && selfieUrl ? (
            <button
              type="button"
              onClick={() => setOpen("compare")}
              className={
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition " +
                (open === "compare"
                  ? "bg-white text-[--admin-text]"
                  : "bg-white/10 text-white hover:bg-white/20")
              }
            >
              Сравнить
              <kbd className="rounded border border-white/30 bg-white/10 px-1 font-mono text-[10px]">
                C
              </kbd>
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpen(null)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/20"
        >
          Закрыть
          <kbd className="rounded border border-white/30 bg-white/10 px-1 font-mono text-[10px]">
            Esc
          </kbd>
        </button>
      </div>

      {/* Image area */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {open === "compare" && passportUrl && selfieUrl ? (
          <div className="flex max-h-full w-full max-w-6xl gap-3">
            <figure className="flex-1 overflow-hidden rounded-lg bg-white/5">
              <figcaption className="border-b border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80">
                Паспорт
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={passportUrl}
                alt="Паспорт"
                className="block max-h-[calc(100vh-150px)] w-full object-contain"
              />
            </figure>
            <figure className="flex-1 overflow-hidden rounded-lg bg-white/5">
              <figcaption className="border-b border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80">
                Selfie / Liveness
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selfieUrl}
                alt="Selfie"
                className="block max-h-[calc(100vh-150px)] w-full object-contain"
              />
            </figure>
          </div>
        ) : open === "passport" && passportUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={passportUrl}
            alt="Паспорт"
            className="max-h-full max-w-full object-contain"
          />
        ) : open === "selfie" && selfieUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selfieUrl}
            alt="Selfie"
            className="max-h-full max-w-full object-contain"
          />
        ) : null}
      </div>

      <p className="border-t border-white/10 px-5 py-2 text-center text-[11px] text-white/50">
        Кликните вне фото или нажмите Esc, чтобы закрыть
      </p>
    </div>
  );
}
