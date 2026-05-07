import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/heic", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadProfilePhoto(
  userId: string,
  file: File,
  isMain: boolean,
  position: number,
): Promise<string> {
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("Unsupported file type");
  if (file.size > MAX_BYTES) throw new Error("File too large");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${isMain ? "main" : `extra-${position}`}-${Date.now()}.${ext}`;
  const buf = await file.arrayBuffer();
  const { error } = await supabaseAdmin.storage
    .from("profile-photos")
    .upload(path, new Uint8Array(buf), {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw error;

  if (isMain) {
    await supabaseAdmin
      .from("profile_photos")
      .update({ is_main: false })
      .eq("user_id", userId);
  }

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
    .select("storage_path")
    .eq("id", photoId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!photo) return;
  await supabaseAdmin.storage.from("profile-photos").remove([photo.storage_path]);
  await supabaseAdmin.from("profile_photos").delete().eq("id", photoId);
}

export async function getSignedPhotoUrl(path: string, ttlSeconds = 60 * 60): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from("profile-photos")
    .createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}
