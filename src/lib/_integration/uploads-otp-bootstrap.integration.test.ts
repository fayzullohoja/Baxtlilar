/**
 * Integration: previously-manual flows automated.
 *   1. Real photo uploads through lib (uploadPassport / uploadSelfie /
 *      uploadProfilePhoto) — touches storage buckets + DB rows.
 *   2. OTP service end-to-end (sendOtp / verifyOtp) — happy path + every
 *      failure mode (invalid, expired, too_many, no_active).
 *   3. Telegram bootstrap end-to-end with valid HMAC initData — insert
 *      branch + update branch.
 *
 * Run: RUN_INTEGRATION=1 npm run test:integration
 *  (or `npm run test:full` which loads .env.local + sets the flag)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const RUN = process.env.RUN_INTEGRATION === "1";
const d = RUN ? describe : describe.skip;

// ---------- shared setup ----------
let supa: SupabaseClient;
const createdUserIds: string[] = [];

async function makeUser(): Promise<string> {
  const tgId = Math.floor(Math.random() * 1_000_000_000) + 8_000_000_000;
  const { data, error } = await supa
    .from("users")
    .insert({ telegram_id: tgId, telegram_first_name: "AutoTest" })
    .select("id")
    .single();
  if (error) throw error;
  createdUserIds.push(data!.id);
  return data!.id;
}

function fakeJpeg(): File {
  // minimal SOI+APP0 jpeg header (10 bytes is enough for storage; not visually valid)
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  return new File([bytes], "test.jpg", { type: "image/jpeg" });
}

// ---------- env + global supabase client ----------
function loadEnv() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE) {
    throw new Error(
      "env not loaded — source .env.local or use `npm run test:full`",
    );
  }
  return { SUPABASE_URL, SERVICE };
}

beforeAll(async () => {
  if (!RUN) return;
  const { SUPABASE_URL, SERVICE } = loadEnv();
  const { createClient } = await import("@supabase/supabase-js");
  supa = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

afterAll(async () => {
  if (!RUN) return;
  // Parallel per-user cleanup: storage objects + cascade-deleted DB rows.
  await Promise.all(
    createdUserIds.map(async (id) => {
      await Promise.all(
        ["documents", "profile-photos"].map(async (bucket) => {
          const { data: files } = await supa.storage.from(bucket).list(id);
          if (files && files.length > 0) {
            await supa.storage
              .from(bucket)
              .remove(files.map((f) => `${id}/${f.name}`));
          }
        }),
      );
      await supa.from("users").delete().eq("id", id);
    }),
  );
}, 120_000);

// ============================================================
// 1. PHOTO UPLOADS — uploadPassport / uploadSelfie / uploadProfilePhoto
// ============================================================
d("uploads (real Supabase Storage)", () => {
  let userId: string;

  beforeEach(async () => {
    userId = await makeUser();
  });

  it("uploadPassport: writes file to documents bucket + user_documents row", async () => {
    const { uploadPassport } = await import("../uploads/documents");
    const path = await uploadPassport(userId, fakeJpeg());

    expect(path).toMatch(new RegExp(`^${userId}/passport-`));

    // file actually exists in storage
    const { data: file, error: dlErr } = await supa.storage
      .from("documents")
      .download(path);
    expect(dlErr).toBeNull();
    expect(file).toBeDefined();

    // row created
    const { data: doc } = await supa
      .from("user_documents")
      .select("passport_path, passport_uploaded_at")
      .eq("user_id", userId)
      .single();
    expect(doc?.passport_path).toBe(path);
    expect(doc?.passport_uploaded_at).toBeTruthy();
  });

  it("uploadSelfie: writes file + upserts onto same user_documents row", async () => {
    const { uploadPassport, uploadSelfie } = await import(
      "../uploads/documents"
    );
    await uploadPassport(userId, fakeJpeg());
    const selfiePath = await uploadSelfie(userId, fakeJpeg());

    expect(selfiePath).toMatch(new RegExp(`^${userId}/selfie-`));

    const { data: doc, count } = await supa
      .from("user_documents")
      .select("passport_path, selfie_path, submitted_at", { count: "exact" })
      .eq("user_id", userId);
    // upsert by user_id PK → single row, not duplicate
    expect(count).toBe(1);
    expect(doc?.[0]?.passport_path).toBeTruthy();
    expect(doc?.[0]?.selfie_path).toBe(selfiePath);
    expect(doc?.[0]?.submitted_at).toBeTruthy();
  });

  it("uploadPassport: rejects unsupported MIME", async () => {
    const { uploadPassport } = await import("../uploads/documents");
    const bad = new File(["pdf"], "x.pdf", { type: "application/pdf" });
    await expect(uploadPassport(userId, bad)).rejects.toThrow(
      /Unsupported file type/,
    );
  });

  it("uploadPassport: rejects > 10MB", async () => {
    const { uploadPassport } = await import("../uploads/documents");
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    await expect(uploadPassport(userId, big)).rejects.toThrow(/File too large/);
  });

  it("uploadProfilePhoto: replace-in-place + signed URL works + delete cleans up", async () => {
    const { uploadProfilePhoto, deletePhoto, getSignedPhotoUrl } = await import(
      "../uploads/photos"
    );

    // upload first as main
    const path1 = await uploadProfilePhoto(userId, fakeJpeg(), true, 0);
    expect(path1).toMatch(new RegExp(`^${userId}/main-`));

    const { data: rows1 } = await supa
      .from("profile_photos")
      .select("id, is_main, position, storage_path")
      .eq("user_id", userId);
    expect(rows1).toHaveLength(1);
    expect(rows1?.[0]?.is_main).toBe(true);

    // upload second as main → old main DELETED (storage + row), not flipped
    await uploadProfilePhoto(userId, fakeJpeg(), true, 0);
    const { data: rows2 } = await supa
      .from("profile_photos")
      .select("id, is_main, storage_path")
      .eq("user_id", userId);
    expect(rows2).toHaveLength(1); // only the new main remains
    expect(rows2?.[0]?.is_main).toBe(true);
    expect(rows2?.[0]?.id).not.toBe(rows1?.[0]?.id);

    // old storage file should be gone
    const { data: gone1 } = await supa.storage
      .from("profile-photos")
      .download(rows1![0].storage_path);
    expect(gone1).toBeNull();

    // signed URL renders for the new main
    const url = await getSignedPhotoUrl(rows2![0].storage_path);
    expect(url).toContain("/object/sign/profile-photos/");

    // explicit delete cleans up storage + DB
    const toDelete = rows2![0];
    await deletePhoto(userId, toDelete.id);
    const { data: rows3 } = await supa
      .from("profile_photos")
      .select("id")
      .eq("user_id", userId);
    expect(rows3).toHaveLength(0);
    const { data: gone2 } = await supa.storage
      .from("profile-photos")
      .download(toDelete.storage_path);
    expect(gone2).toBeNull();
  });

  it("uploadProfilePhoto: extra at same position replaces old", async () => {
    const { uploadProfilePhoto } = await import("../uploads/photos");

    // need a main first (otherwise this is just "first photo as extra")
    await uploadProfilePhoto(userId, fakeJpeg(), true, 0);

    const path1 = await uploadProfilePhoto(userId, fakeJpeg(), false, 1);
    const { data: r1 } = await supa
      .from("profile_photos")
      .select("id, position, storage_path")
      .eq("user_id", userId)
      .eq("position", 1);
    expect(r1).toHaveLength(1);
    expect(r1?.[0]?.storage_path).toBe(path1);

    // re-upload at position 1 → old extra at position 1 deleted
    const path2 = await uploadProfilePhoto(userId, fakeJpeg(), false, 1);
    const { data: r2 } = await supa
      .from("profile_photos")
      .select("id, storage_path")
      .eq("user_id", userId)
      .eq("position", 1);
    expect(r2).toHaveLength(1);
    expect(r2?.[0]?.storage_path).toBe(path2);
    expect(r2?.[0]?.storage_path).not.toBe(path1);
  });

  it("uploadProfilePhoto: rejects > 5MB (photos bucket smaller than docs)", async () => {
    const { uploadProfilePhoto } = await import("../uploads/photos");
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    await expect(
      uploadProfilePhoto(userId, big, true, 0),
    ).rejects.toThrow(/File too large/);
  });
});

// ============================================================
// 2. OTP SERVICE — sendOtp / verifyOtp full lifecycle
// ============================================================
d("OTP service (real DB, mock SMS)", () => {
  let userId: string;
  const phone = "+998901234567";

  beforeEach(async () => {
    userId = await makeUser();
    process.env.SMS_PROVIDER = "mock";
    // Tests issue many sendOtp calls in succession — bypass rate limiting.
    process.env.OTP_DISABLE_RATE_LIMIT = "1";
  });

  it("sendOtp inserts a new row with hashed code + future expiry", async () => {
    const { sendOtp } = await import("../otp/service");
    await sendOtp(userId, phone);

    const { data: rows } = await supa
      .from("otp_codes")
      .select("phone_number, code_hash, expires_at, consumed_at, attempts")
      .eq("user_id", userId);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.phone_number).toBe(phone);
    expect(rows?.[0]?.code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows?.[0]?.consumed_at).toBeNull();
    expect(rows?.[0]?.attempts).toBe(0);
    expect(new Date(rows?.[0]?.expires_at).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("sendOtp twice: previous active code is consumed, only newest is active", async () => {
    const { sendOtp } = await import("../otp/service");
    await sendOtp(userId, phone);
    await sendOtp(userId, phone);

    const { data: active } = await supa
      .from("otp_codes")
      .select("id")
      .eq("user_id", userId)
      .is("consumed_at", null);
    expect(active).toHaveLength(1);
  });

  it("verifyOtp dev shortcut: 123456 succeeds + consumes active code", async () => {
    const { sendOtp, verifyOtp } = await import("../otp/service");
    await sendOtp(userId, phone);

    const result = await verifyOtp(userId, "123456");
    expect(result.ok).toBe(true);

    const { data: active } = await supa
      .from("otp_codes")
      .select("id")
      .eq("user_id", userId)
      .is("consumed_at", null);
    expect(active).toHaveLength(0);
  });

  it("verifyOtp invalid format → reason=invalid", async () => {
    const { verifyOtp } = await import("../otp/service");
    const result = await verifyOtp(userId, "12");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });

  it("verifyOtp no active code → reason=no_active", async () => {
    const { verifyOtp } = await import("../otp/service");
    // bypass dev shortcut by switching provider
    process.env.SMS_PROVIDER = "real-not-implemented";
    const result = await verifyOtp(userId, "999999");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_active");
    process.env.SMS_PROVIDER = "mock";
  });

  it("verifyOtp wrong code increments attempts; max+1 → too_many", async () => {
    const { verifyOtp } = await import("../otp/service");
    // insert manually to control hash + max_attempts (no dev-shortcut interference)
    process.env.SMS_PROVIDER = "real-not-implemented";
    const realHash = crypto.createHash("sha256").update("000111").digest("hex");
    await supa.from("otp_codes").insert({
      user_id: userId,
      phone_number: phone,
      code_hash: realHash,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      attempts: 0,
      max_attempts: 3,
    });

    // 3 wrong attempts
    for (let i = 0; i < 3; i++) {
      const r = await verifyOtp(userId, "999999");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("invalid");
    }

    // 4th must be blocked as too_many
    const blocked = await verifyOtp(userId, "999999");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe("too_many");

    process.env.SMS_PROVIDER = "mock";
  });

  it("verifyOtp expired code → reason=expired", async () => {
    const { verifyOtp } = await import("../otp/service");
    process.env.SMS_PROVIDER = "real-not-implemented";
    const realHash = crypto.createHash("sha256").update("424242").digest("hex");
    await supa.from("otp_codes").insert({
      user_id: userId,
      phone_number: phone,
      code_hash: realHash,
      expires_at: new Date(Date.now() - 10_000).toISOString(),
    });
    const r = await verifyOtp(userId, "424242");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
    process.env.SMS_PROVIDER = "mock";
  });

  it("verifyOtp correct code (real flow, no dev-shortcut): consumed", async () => {
    const { verifyOtp } = await import("../otp/service");
    process.env.SMS_PROVIDER = "real-not-implemented";
    const realHash = crypto.createHash("sha256").update("777888").digest("hex");
    await supa.from("otp_codes").insert({
      user_id: userId,
      phone_number: phone,
      code_hash: realHash,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    const r = await verifyOtp(userId, "777888");
    expect(r.ok).toBe(true);

    const { data: active } = await supa
      .from("otp_codes")
      .select("id")
      .eq("user_id", userId)
      .is("consumed_at", null);
    expect(active).toHaveLength(0);
    process.env.SMS_PROVIDER = "mock";
  });
});

// ============================================================
// 3. TELEGRAM BOOTSTRAP — full HMAC + DB + cookie path
// ============================================================
d("Telegram bootstrap (real HMAC + DB + cookie)", () => {
  function buildSignedInitData(
    botToken: string,
    user: { id: number; first_name: string; username?: string },
  ): string {
    const params = new URLSearchParams({
      user: JSON.stringify(user),
      auth_date: String(Math.floor(Date.now() / 1000)),
    });
    const dataCheckString = Array.from(params.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();
    const hash = crypto
      .createHmac("sha256", secret)
      .update(dataCheckString)
      .digest("hex");
    params.set("hash", hash);
    return params.toString();
  }

  const tgId = Math.floor(Math.random() * 1_000_000_000) + 7_000_000_000;
  const realToken = process.env.TELEGRAM_BOT_TOKEN ?? "test_bot_token";

  beforeAll(async () => {
    if (!RUN) return;
    process.env.DEV_BYPASS_TG = "0";
    process.env.TELEGRAM_BOT_TOKEN = realToken;
  });

  it("first call inserts user row + sets session cookie", async () => {
    const { bootstrapFromTelegram } = await import("../auth/bootstrap");
    const { getTestCookie, clearTestCookies } = await import(
      "../../../test-stubs/next-headers"
    );
    clearTestCookies();

    const initData = buildSignedInitData(realToken, {
      id: tgId,
      first_name: "BootTest",
      username: "boottest",
    });

    const userId = await bootstrapFromTelegram(initData);
    createdUserIds.push(userId);

    expect(userId).toMatch(/^[a-f0-9-]{36}$/);
    const { data: user } = await supa
      .from("users")
      .select("telegram_id, telegram_first_name, telegram_username, lifecycle_state")
      .eq("id", userId)
      .single();
    expect(user?.telegram_id).toBe(tgId);
    expect(user?.telegram_first_name).toBe("BootTest");
    expect(user?.telegram_username).toBe("boottest");
    expect(user?.lifecycle_state).toBe("onboarding");

    // cookie was set
    const cookie = getTestCookie("bakht_session");
    expect(cookie).toBeTruthy();
    expect(cookie).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("second call with same telegram_id updates same user (no duplicate)", async () => {
    const { bootstrapFromTelegram } = await import("../auth/bootstrap");
    const initData = buildSignedInitData(realToken, {
      id: tgId,
      first_name: "BootTestRenamed",
      username: "boottest_v2",
    });

    const userId2 = await bootstrapFromTelegram(initData);
    // same userId as the first call
    expect(createdUserIds).toContain(userId2);

    const { data: rows, count } = await supa
      .from("users")
      .select("id, telegram_first_name, telegram_username", { count: "exact" })
      .eq("telegram_id", tgId);
    expect(count).toBe(1);
    expect(rows?.[0]?.telegram_first_name).toBe("BootTestRenamed");
    expect(rows?.[0]?.telegram_username).toBe("boottest_v2");
  });

  it("rejects bad HMAC", async () => {
    const { bootstrapFromTelegram } = await import("../auth/bootstrap");
    const bad = new URLSearchParams({
      user: JSON.stringify({ id: 666, first_name: "Hacker" }),
      auth_date: String(Math.floor(Date.now() / 1000)),
      hash: "deadbeef".repeat(8),
    }).toString();
    await expect(bootstrapFromTelegram(bad)).rejects.toThrow(
      /Invalid Telegram initData/,
    );
  });

  it("session cookie verifies back via decodeSession", async () => {
    const { decodeSession } = await import("../auth/session");
    const { getTestCookie } = await import(
      "../../../test-stubs/next-headers"
    );
    const cookie = getTestCookie("bakht_session");
    expect(cookie).toBeTruthy();
    const payload = decodeSession(cookie!);
    expect(payload).not.toBeNull();
    expect(payload?.user_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
