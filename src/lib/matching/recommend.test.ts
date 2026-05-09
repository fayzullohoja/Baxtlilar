/**
 * Unit tests for recommendFor() — verifies hard filters (mutual gender, age,
 * verified, dedup), score computation (city/district/interest/age-diff), and
 * sorting/top-N truncation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Profile = {
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

const state = {
  viewerProfile: null as Profile | null,
  candidates: [] as Profile[],
  requested: [] as Array<{ sender_id: string; receiver_id: string; status: string }>,
  viewed: [] as Array<{ target_id: string }>,
  photos: [] as Array<{ user_id: string; storage_path: string }>,
};

function birthForAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "user_profiles") {
        return {
          select: (cols: string) => {
            // Viewer's own profile has no joined `users` table
            if (!cols.includes("users:users")) {
              return {
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: state.viewerProfile, error: null }),
                }),
              };
            }
            // Candidate pool with all the chained .eq().eq()...limit()
            const chain = {
              eq: () => chain,
              limit: () => Promise.resolve({ data: state.candidates, error: null }),
            };
            return chain;
          },
        };
      }
      if (table === "match_requests") {
        return {
          select: () => ({
            or: () => Promise.resolve({ data: state.requested, error: null }),
          }),
        };
      }
      if (table === "match_views") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => Promise.resolve({ data: state.viewed, error: null }),
            }),
          }),
        };
      }
      if (table === "profile_photos") {
        return {
          select: () => ({
            in: () => ({
              eq: () => Promise.resolve({ data: state.photos, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

const { recommendFor } = await import("./recommend");

describe("recommendFor()", () => {
  beforeEach(() => {
    state.viewerProfile = {
      user_id: "viewer",
      display_name: "Viewer",
      birth_date: birthForAge(25),
      gender: "male",
      city: "Tashkent",
      district: "Yunusabad",
      about_me: null,
      interests: ["music", "books", "travel"],
      preferred_age_min: 20,
      preferred_age_max: 30,
      looking_for_gender: "female",
      is_discoverable: true,
      profile_paused: false,
    };
    state.candidates = [];
    state.requested = [];
    state.viewed = [];
    state.photos = [];
  });

  it("returns [] when viewer has no profile", async () => {
    state.viewerProfile = null;
    expect(await recommendFor("viewer")).toEqual([]);
  });

  it("returns [] when viewer is missing gender or birth_date", async () => {
    state.viewerProfile!.gender = null;
    expect(await recommendFor("viewer")).toEqual([]);
  });

  it("returns [] when viewer has no looking_for_gender", async () => {
    state.viewerProfile!.looking_for_gender = null;
    expect(await recommendFor("viewer")).toEqual([]);
  });

  it("excludes self even if accidentally in candidate pool", async () => {
    state.candidates = [{ ...state.viewerProfile!, user_id: "viewer" }];
    const out = await recommendFor("viewer");
    expect(out).toEqual([]);
  });

  it("excludes candidates with open (pending/accepted) requests in either direction", async () => {
    state.candidates = [
      makeCandidate("c-1", { city: "Tashkent" }),
      makeCandidate("c-2", { city: "Tashkent" }),
      makeCandidate("c-3", { city: "Tashkent" }),
    ];
    state.requested = [
      { sender_id: "viewer", receiver_id: "c-1", status: "pending" },
      { sender_id: "c-2", receiver_id: "viewer", status: "accepted" },
    ];
    const out = await recommendFor("viewer");
    expect(out.map((r) => r.user_id)).toEqual(["c-3"]);
  });

  it("excludes candidates that were declined (in either direction)", async () => {
    state.candidates = [
      makeCandidate("c-1", { city: "Tashkent" }),
      makeCandidate("c-2", { city: "Tashkent" }),
    ];
    state.requested = [
      { sender_id: "c-1", receiver_id: "viewer", status: "declined" },
    ];
    const out = await recommendFor("viewer");
    expect(out.map((r) => r.user_id)).toEqual(["c-2"]);
  });

  it("excludes candidates from match_views", async () => {
    state.candidates = [
      makeCandidate("c-1", { city: "Tashkent" }),
      makeCandidate("c-2", { city: "Tashkent" }),
    ];
    state.viewed = [{ target_id: "c-1" }];
    const out = await recommendFor("viewer");
    expect(out.map((r) => r.user_id)).toEqual(["c-2"]);
  });

  it("filters by viewer's preferred age range", async () => {
    state.viewerProfile!.preferred_age_min = 25;
    state.viewerProfile!.preferred_age_max = 28;
    state.candidates = [
      makeCandidate("too-young", { birth_date: birthForAge(22) }),
      makeCandidate("just-right", { birth_date: birthForAge(26) }),
      makeCandidate("too-old", { birth_date: birthForAge(35) }),
    ];
    const out = await recommendFor("viewer");
    expect(out.map((r) => r.user_id)).toEqual(["just-right"]);
  });

  it("filters by candidate's preferred age range (mutual)", async () => {
    // Viewer is 25; candidate "picky" wants 30+, so should be filtered out
    state.candidates = [
      makeCandidate("picky", { preferred_age_min: 30 }),
      makeCandidate("ok", { preferred_age_min: 20, preferred_age_max: 30 }),
    ];
    const out = await recommendFor("viewer");
    expect(out.map((r) => r.user_id)).toEqual(["ok"]);
  });

  it("scores city match higher than non-match", async () => {
    state.candidates = [
      makeCandidate("same-city", { city: "Tashkent" }),
      makeCandidate("other-city", { city: "Samarkand" }),
    ];
    const out = await recommendFor("viewer");
    expect(out.map((r) => r.user_id)).toEqual(["same-city", "other-city"]);
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it("scores district match on top of city", async () => {
    state.candidates = [
      makeCandidate("same-district", {
        city: "Tashkent",
        district: "Yunusabad",
      }),
      makeCandidate("same-city", { city: "Tashkent", district: "Mirzo" }),
    ];
    const out = await recommendFor("viewer");
    expect(out[0].user_id).toBe("same-district");
    expect(out[0].score - out[1].score).toBe(10);
  });

  it("scores interest overlap up to 5 matches", async () => {
    state.candidates = [
      makeCandidate("zero-overlap", { interests: ["sports", "cooking"] }),
      makeCandidate("two-overlap", { interests: ["music", "books", "sports"] }),
      makeCandidate("triple-overlap", {
        interests: ["music", "books", "travel"],
      }),
    ];
    const out = await recommendFor("viewer");
    // triple-overlap (3 matches × 5 = +15) > two-overlap (+10) > zero-overlap
    expect(out.map((r) => r.user_id)).toEqual([
      "triple-overlap",
      "two-overlap",
      "zero-overlap",
    ]);
  });

  it("caps interest-overlap bonus at 5 matches (i.e. +25 max)", async () => {
    state.viewerProfile!.interests = [
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ];
    state.candidates = [
      // 5 overlaps (cap)
      makeCandidate("five", { interests: ["a", "b", "c", "d", "e"] }),
      // 8 overlaps (also cap, same score)
      makeCandidate("eight", { interests: ["a", "b", "c", "d", "e", "f", "g", "h"] }),
    ];
    const out = await recommendFor("viewer");
    expect(out[0].score).toBe(out[1].score);
  });

  it("applies age-diff penalty (closer in age scores higher)", async () => {
    // Viewer is 25; both candidates same city, different ages
    state.candidates = [
      makeCandidate("close", { birth_date: birthForAge(26) }),
      makeCandidate("far", { birth_date: birthForAge(30) }),
    ];
    const out = await recommendFor("viewer");
    expect(out[0].user_id).toBe("close");
    expect(out[0].score - out[1].score).toBe(4); // |26-25|=1 vs |30-25|=5
  });

  it("respects the limit parameter (top N by score)", async () => {
    state.candidates = Array.from({ length: 12 }, (_, i) =>
      makeCandidate(`c-${i}`, { city: "Tashkent" }),
    );
    const out = await recommendFor("viewer", 3);
    expect(out).toHaveLength(3);
  });

  it("attaches main_photo_path for top results", async () => {
    state.candidates = [makeCandidate("c-1", { city: "Tashkent" })];
    state.photos = [{ user_id: "c-1", storage_path: "photos/c-1/main.jpg" }];
    const out = await recommendFor("viewer");
    expect(out[0].main_photo_path).toBe("photos/c-1/main.jpg");
  });

  it("returns null main_photo_path when no photo exists", async () => {
    state.candidates = [makeCandidate("c-1", { city: "Tashkent" })];
    const out = await recommendFor("viewer");
    expect(out[0].main_photo_path).toBeNull();
  });

  it("skips candidates with null birth_date (can't compute age)", async () => {
    state.candidates = [
      makeCandidate("no-bday", { birth_date: null }),
      makeCandidate("ok", { city: "Tashkent" }),
    ];
    const out = await recommendFor("viewer");
    expect(out.map((r) => r.user_id)).toEqual(["ok"]);
  });
});

function makeCandidate(id: string, overrides: Partial<Profile>): Profile {
  return {
    user_id: id,
    display_name: id,
    birth_date: birthForAge(25),
    gender: "female",
    city: "Other",
    district: null,
    about_me: null,
    interests: [],
    preferred_age_min: null,
    preferred_age_max: null,
    looking_for_gender: "male",
    is_discoverable: true,
    profile_paused: false,
    ...overrides,
  };
}
