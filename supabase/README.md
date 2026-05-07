# Supabase setup

## Apply migrations to a fresh Supabase project

1. Go to your Supabase Dashboard → SQL Editor
2. Open `migrations/20260507_init_bakhtlilar_schema.sql` and run it
3. Open `migrations/20260507_init_storage_buckets.sql` and run it
4. Get keys from Dashboard → Project Settings → API Keys:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **publishable / anon key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **secret / service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
5. Set those three vars on Vercel (or in `.env.local` for local dev)

## What's inside

- 9 tables: `users`, `otp_codes`, `user_documents`, `user_profiles`,
  `profile_photos`, `quiz_answers`, `quiz_results`, `user_state_transitions`
- 8 enums (lifecycle, onboarding step, verification, profile/quiz completion, language, gender, marital)
- 2 storage buckets: `documents` (passport+selfie, 10MB), `profile-photos` (profile pics, 5MB)
- `updated_at` trigger on `users`, `user_documents`, `user_profiles`
