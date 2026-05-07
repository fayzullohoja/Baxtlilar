import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/heic", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

async function uploadToBucket(
  bucket: string,
  userId: string,
  file: File,
  kind: string,
) {
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("Unsupported file type");
  if (file.size > MAX_BYTES) throw new Error("File too large");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const buf = await file.arrayBuffer();
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, new Uint8Array(buf), {
      contentType: file.type,
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
