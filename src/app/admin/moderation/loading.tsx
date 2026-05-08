export default function Loading() {
  return (
    <div className="admin-scope min-h-dvh bg-[--admin-bg]">
      <div className="mx-auto max-w-6xl px-5 py-12 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-[--admin-text-2]">
          <span
            className="inline-block h-3 w-3 animate-pulse rounded-full"
            style={{ backgroundColor: "var(--admin-accent)" }}
          />
          Загружаем очередь…
        </div>
      </div>
    </div>
  );
}
