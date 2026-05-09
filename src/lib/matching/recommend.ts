import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Recommendation = {
  user_id: string;
  display_name: string | null;
  age: number | null;
  city: string | null;
  district: string | null;
  about_me: string | null;
  interests: string[] | null;
  main_photo_path: string | null;
  score: number;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  birth_date: string | null;
  gender: "male" | "female" | null;
  city: string | null;
  district: string | null;
  about_me: string | null;
  interests: string[] | null;
  preferred_age_min: number | null;
  preferred_age_max: number | null;
  looking_for_gender: "male" | "female" | null;
  is_discoverable: boolean | null;
  profile_paused: boolean | null;
};

const TODAY_MS = 1000 * 60 * 60 * 24 * 365.25;

function ageFrom(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / TODAY_MS);
}

/**
 * Build feed for `viewerId`.
 * Hard filters: opposite gender mutual, ages in mutual ranges, both discoverable
 * and active+approved, not already exchanged a request, not seen recently.
 */
export async function recommendFor(
  viewerId: string,
  limit = 10,
): Promise<Recommendation[]> {
  // 1) viewer's profile and prefs
  const { data: me } = await supabaseAdmin
    .from("user_profiles")
    .select(
      "user_id, gender, birth_date, city, district, looking_for_gender, preferred_age_min, preferred_age_max, interests",
    )
    .eq("user_id", viewerId)
    .maybeSingle();
  if (!me) return [];
  const myAge = ageFrom(me.birth_date);
  if (!me.gender || !me.looking_for_gender || myAge == null) return [];

  // 2) exclusion sets
  const [{ data: requested }, { data: viewed }] = await Promise.all([
    supabaseAdmin
      .from("match_requests")
      .select("sender_id, receiver_id, status")
      .or(`sender_id.eq.${viewerId},receiver_id.eq.${viewerId}`),
    supabaseAdmin
      .from("match_views")
      .select("target_id")
      .eq("viewer_id", viewerId)
      .gte(
        "created_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      ),
  ]);

  const blocked = new Set<string>([viewerId]);
  for (const r of requested ?? []) {
    if (r.status === "pending" || r.status === "accepted") {
      blocked.add(r.sender_id === viewerId ? r.receiver_id : r.sender_id);
    }
    if (r.status === "declined") {
      // hide declined-for-me people for 30 days; for now permanent for simplicity
      blocked.add(r.sender_id === viewerId ? r.receiver_id : r.sender_id);
    }
  }
  for (const v of viewed ?? []) blocked.add(v.target_id);

  // 3) candidate pool: opposite gender, looking for me, active+approved+discoverable
  // Note: we filter by gender here but post-filter ages/etc in JS to avoid huge IN list.
  const { data: candidates } = await supabaseAdmin
    .from("user_profiles")
    .select(
      "user_id, display_name, birth_date, gender, city, district, about_me, interests, preferred_age_min, preferred_age_max, looking_for_gender, is_discoverable, profile_paused, users:users!inner(lifecycle_state, verification_status)",
    )
    .eq("gender", me.looking_for_gender)
    .eq("looking_for_gender", me.gender)
    .eq("is_discoverable", true)
    .eq("profile_paused", false)
    .eq("users.lifecycle_state", "active")
    .eq("users.verification_status", "approved")
    .limit(200);

  const pool = (candidates ?? []) as unknown as ProfileRow[];
  const out: Recommendation[] = [];

  for (const c of pool) {
    if (blocked.has(c.user_id)) continue;
    const age = ageFrom(c.birth_date);
    if (age == null) continue;

    // mutual age fit
    if (me.preferred_age_min != null && age < me.preferred_age_min) continue;
    if (me.preferred_age_max != null && age > me.preferred_age_max) continue;
    if (c.preferred_age_min != null && myAge < c.preferred_age_min) continue;
    if (c.preferred_age_max != null && myAge > c.preferred_age_max) continue;

    // score
    let score = 50;
    if (c.city && me.city && c.city === me.city) score += 25;
    if (c.district && me.district && c.district === me.district) score += 10;
    const overlap = (c.interests ?? []).filter((i) =>
      (me.interests ?? []).includes(i),
    ).length;
    score += Math.min(overlap, 5) * 5;
    score -= Math.min(Math.abs(age - myAge), 15);

    out.push({
      user_id: c.user_id,
      display_name: c.display_name,
      age,
      city: c.city,
      district: c.district,
      about_me: c.about_me,
      interests: c.interests,
      main_photo_path: null,
      score,
    });
  }

  out.sort((a, b) => b.score - a.score);
  const top = out.slice(0, limit);

  // 4) attach main photo for the top results
  if (top.length > 0) {
    const ids = top.map((r) => r.user_id);
    const { data: photos } = await supabaseAdmin
      .from("profile_photos")
      .select("user_id, storage_path")
      .in("user_id", ids)
      .eq("is_main", true);
    const map = new Map<string, string>();
    for (const p of photos ?? []) map.set(p.user_id, p.storage_path);
    for (const r of top) r.main_photo_path = map.get(r.user_id) ?? null;
  }

  return top;
}

/** Mark feed entries as "seen" so they don't reappear immediately. */
export async function markSeen(
  viewerId: string,
  targetIds: string[],
): Promise<void> {
  if (targetIds.length === 0) return;
  await supabaseAdmin
    .from("match_views")
    .upsert(
      targetIds.map((id) => ({ viewer_id: viewerId, target_id: id })),
      { onConflict: "viewer_id,target_id" },
    );
}
