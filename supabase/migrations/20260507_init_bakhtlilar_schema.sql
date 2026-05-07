-- ============================================================
-- Bakhtlilar — initial schema
-- Apply order: this file FIRST, then 20260507_init_storage_buckets.sql
-- Apply via: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

-- ===== ENUMS =====
create type lifecycle_state as enum ('onboarding','active','paused','blocked','deleted');
create type onboarding_step as enum (
  'language','security_intro','phone_input','otp_pending',
  'verification_intro','document_upload','liveness_upload',
  'moderation_submitted','moderation_pending','verification_rejected',
  'profile_basic','profile_photos','profile_education','profile_family',
  'profile_values','profile_looking_for','profile_about','profile_preview',
  'quiz_intro','quiz_in_progress','quiz_result','complete'
);
create type verification_status as enum (
  'not_started','phone_verified','documents_uploaded','liveness_uploaded',
  'pending_review','approved','rejected','revoked'
);
create type profile_completion as enum (
  'not_started','in_progress','completed','pending_remoderation'
);
create type quiz_completion as enum ('not_started','in_progress','completed');
create type user_language as enum ('ru','uz');
create type user_gender as enum ('male','female');
create type marital_status_t as enum ('never_married','divorced','widowed');

-- ===== USERS =====
create table users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  language user_language,
  phone_number text unique,
  phone_verified boolean default false,
  phone_verified_at timestamptz,
  lifecycle_state lifecycle_state default 'onboarding',
  onboarding_step onboarding_step default 'language',
  verification_status verification_status default 'not_started',
  profile_completion profile_completion default 'not_started',
  quiz_completion quiz_completion default 'not_started',
  paused_at timestamptz,
  blocked_at timestamptz,
  blocked_reason text,
  rules_seen boolean default false,
  security_intro_seen boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_users_telegram on users(telegram_id);
create index idx_users_phone on users(phone_number) where phone_number is not null;

-- ===== OTP =====
create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  phone_number text not null,
  code_hash text not null,
  attempts int default 0,
  max_attempts int default 5,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create index idx_otp_user_phone on otp_codes(user_id, phone_number);
create index idx_otp_active on otp_codes(user_id) where consumed_at is null;

-- ===== DOCUMENTS (passport + selfie) =====
create table user_documents (
  user_id uuid primary key references users(id) on delete cascade,
  passport_path text,
  passport_uploaded_at timestamptz,
  selfie_path text,
  selfie_uploaded_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_admin_id uuid,
  rejection_reason text,
  rejection_kind text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===== PROFILES (anketa) =====
create table user_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text,
  birth_date date,
  gender user_gender,
  city text,
  district text,
  marital_status marital_status_t,
  currently_married boolean,
  education_level text,
  work_industry text,
  profession text,
  employment_status text,
  financial_stability text,
  has_children text,
  wants_children text,
  marriage_timeline text,
  relocation_readiness text,
  religiosity_level text,
  smoking_status text,
  alcohol_status text,
  interests text[],
  looking_for_gender user_gender,
  preferred_age_min int,
  preferred_age_max int,
  preferred_city_scope text,
  preferred_marital_status text,
  preferred_children_status text,
  preferred_partner_qualities text[],
  about_me text,
  marriage_values_text text,
  photo_privacy_mode text default 'public_verified_users',
  profession_visibility text default 'all_verified',
  is_discoverable boolean default true,
  profile_paused boolean default false,
  profile_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===== PHOTOS =====
create table profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  storage_path text not null,
  is_main boolean default false,
  position int default 0,
  created_at timestamptz default now()
);
create index idx_profile_photos_user on profile_photos(user_id);

-- ===== QUIZ =====
create table quiz_answers (
  user_id uuid not null references users(id) on delete cascade,
  question_id text not null,
  answer jsonb not null,
  created_at timestamptz default now(),
  primary key (user_id, question_id)
);

create table quiz_results (
  user_id uuid primary key references users(id) on delete cascade,
  intention_type text,
  relationship_tempo text,
  communication_style text,
  family_values_score numeric,
  conflict_style text,
  privacy_preference text,
  match_priority_score numeric,
  raw_dimensions jsonb,
  completed_at timestamptz default now()
);

-- ===== AUDIT =====
create table user_state_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  reason text,
  triggered_by text,
  triggered_by_id uuid,
  created_at timestamptz default now()
);
create index idx_state_transitions_user on user_state_transitions(user_id);

-- ===== updated_at TRIGGER =====
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();
create trigger trg_documents_updated before update on user_documents
  for each row execute function set_updated_at();
create trigger trg_profiles_updated before update on user_profiles
  for each row execute function set_updated_at();
