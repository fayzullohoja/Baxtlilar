import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function build(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key || key === "PASTE_SERVICE_ROLE_KEY_HERE" || key === "stub_for_build") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — copy from https://supabase.com/dashboard/project/fdehbwckmhqgotikpzyj/settings/api-keys (secret) and add to env",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Lazy server-only Supabase client with service-role privileges.
 * Initialization is deferred until first property access so that build-time
 * prerender of static pages does not require the secret to be set.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) _client = build();
    // @ts-expect-error dynamic forward
    const v = _client[prop];
    return typeof v === "function" ? v.bind(_client) : v;
  },
});
