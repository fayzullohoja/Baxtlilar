import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { detectImageType } from "./mime-check";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/heic", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EXTRA_PHOTOS = 4;
const TYPE_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};
const TYPE_TO_EXT: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  heic: "heic",
};

export async function uploadProfilePhoto(
  userId: string,
  file: File,
  isMain: boolean,
  position: number,
): Promise<string> {
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("Unsupported file type");
  if (file.size > MAX_BYTES) throw new Error("File too large");
  const detected = await detectImageType(file);
  if (!detected) throw new Error("Unsupported file type");

  // Replace-in-place: if uploading a new MAIN, the old main is deleted entirely
  // (storage + DB row) so it doesn't accumulate as an "extra". Same for extras
  // at a specific position — old row at that position is removed before insert.
  // Without this, replaced photos became orphan storage objects forever.
  let displaced;
  if (isMain) {
    ({ data: displaced } = await supabaseAdmin
      .from("profile_photos")
      .select("id, storage_path")
      .eq("user_id", userId)
      .eq("is_main", true));
  } else {
    ({ data: displaced } = await supabaseAdmin
      .from("profile_photos")
      .select("id, storage_path")
      .eq("user_id", userId)
      .eq("position", position)
      .eq("is_main", false));
  }
  if (displaced && displaced.length > 0) {
    await supabaseAdmin.storage
      .from("profile-photos")
      .remove(displaced.map((d) => d.storage_path))
      .catch(() => {});
    await supabaseAdmin
      .from("profile_photos")
      .delete()
      .in(
        "id",
        displaced.map((d) => d.id),
      );
  }

  // Enforce photo count: at most N extras (after the displacement above).
  if (!isMain) {
    const { count } = await supabaseAdmin
      .from("profile_photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_main", false);
    if ((count ?? 0) >= MAX_EXTRA_PHOTOS) {
      throw new Error("Photo limit reached");
    }
  }

  const path = `${userId}/${isMain ? "main" : `extra-${position}`}-${Date.now()}.${TYPE_TO_EXT[detected]}`;
  const buf = await file.arrayBuffer();
  const { error } = await supabaseAdmin.storage
    .from("profile-photos")
    .upload(path, new Uint8Array(buf), {
      contentType: TYPE_TO_MIME[detected],
      upsert: false,
    });
  if (error) throw error;

  await supabaseAdmin.from("profile_photos").insert({
    user_id: userId,
    storage_path: path,
    is_main: isMain,
    position,
  });
  return path;
}

export async function deletePhoto(userId: string, photoId: string) {
  const { data: photo } = await supabaseAdmin
    .from("profile_photos")
    .select("storage_path, is_main")
    .eq("id", photoId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!photo) return;
  await supabaseAdmin.storage.from("profile-photos").remove([photo.storage_path]);
  await supabaseAdmin.from("profile_photos").delete().eq("id", photoId);

  // If we just removed the main photo, promote the oldest remaining extra
  // to main. Otherwise the user is stuck without a main and the "Continue"
  // button on /onboarding/profile/photos stays disabled.
  if (photo.is_main) {
    const { data: nextMain } = await supabaseAdmin
      .from("profile_photos")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextMain?.id) {
      await supabaseAdmin
        .from("profile_photos")
        .update({ is_main: true })
        .eq("id", nextMain.id);
    }
  }
}

export async function getSignedPhotoUrl(path: string, ttlSeconds = 60 * 60): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from("profile-photos")
    .createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}
