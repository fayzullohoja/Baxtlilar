import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { detectImageType } from "./mime-check";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/heic", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
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

async function uploadToBucket(
  bucket: string,
  userId: string,
  file: File,
  kind: string,
) {
  // First-pass: client-set MIME (cheap reject for obvious wrong types)
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("Unsupported file type");
  if (file.size > MAX_BYTES) throw new Error("File too large");

  // Second-pass: magic-byte detection — defense against MIME spoofing.
  // Trust the bytes, not the client header. We rewrite the stored
  // contentType to match what we actually see.
  const detected = await detectImageType(file);
  if (!detected) throw new Error("Unsupported file type");

  const path = `${userId}/${kind}-${Date.now()}.${TYPE_TO_EXT[detected]}`;
  const buf = await file.arrayBuffer();
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, new Uint8Array(buf), {
      contentType: TYPE_TO_MIME[detected],
      upsert: false,
    });
  if (error) throw error;
  return path;
}

export async function uploadPassport(userId: string, file: File): Promise<string> {
  const path = await uploadToBucket("documents", userId, file, "passport");
  await supabaseAdmin
    .from("user_documents")
    .upsert(
      {
        user_id: userId,
        passport_path: path,
        passport_uploaded_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  return path;
}

export async function uploadSelfie(userId: string, file: File): Promise<string> {
  const path = await uploadToBucket("documents", userId, file, "selfie");
  await supabaseAdmin
    .from("user_documents")
    .upsert(
      {
        user_id: userId,
        selfie_path: path,
        selfie_uploaded_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  return path;
}
