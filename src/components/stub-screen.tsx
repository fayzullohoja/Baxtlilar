import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";

export function StubScreen({
  title,
  subtitle,
  buttonLabel,
  action,
  notes,
}: {
  title: string;
  subtitle?: string;
  buttonLabel: string;
  action: () => void | Promise<void>;
  notes?: string[];
}) {
  return (
    <Screen>
      <ScreenHeader title={title} subtitle={subtitle} />
      <ScreenBody>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-medium">Заглушка экрана</p>
          {notes?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </ScreenBody>
      <ScreenFooter>
        <form action={action}>
          <PrimaryButton type="submit">{buttonLabel}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}
