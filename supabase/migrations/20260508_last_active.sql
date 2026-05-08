-- ============================================================
-- last_active_at — track when each user last touched the app.
-- Apply via Supabase SQL Editor.
-- ============================================================

alter table users
  add column if not exists last_active_at timestamptz default now();

create index if not exists idx_users_last_active
  on users(last_active_at) where last_active_at is not null;

comment on column users.last_active_at is
  'Updated on every authenticated page load via requireUser(). Used by admin panel to filter inactive users.';
