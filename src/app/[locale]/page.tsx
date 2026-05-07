import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { nextScreenFor } from "@/lib/state-machine/router";

export default async function EntryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/onboarding/welcome`);
  redirect(`/${locale}${nextScreenFor(user)}`);
}
