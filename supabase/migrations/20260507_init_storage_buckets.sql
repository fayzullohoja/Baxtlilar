-- Bakhtlilar — storage buckets (private, signed-URL access)
-- Apply AFTER 20260507_init_bakhtlilar_schema.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 10485760,
    array['image/jpeg','image/png','image/heic','image/webp']),
  ('profile-photos', 'profile-photos', false, 5242880,
    array['image/jpeg','image/png','image/heic','image/webp']);
