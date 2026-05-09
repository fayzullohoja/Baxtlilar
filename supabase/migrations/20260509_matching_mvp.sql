-- Matching MVP: requests, views, chats, messages, daily quota.
-- Apply via Supabase Dashboard → SQL Editor for project fdehbwckmhqgotikpzyj.

DO $$ BEGIN
  CREATE TYPE match_request_status AS ENUM (
    'pending', 'accepted', 'declined', 'withdrawn', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.match_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          match_request_status NOT NULL DEFAULT 'pending',
  intro_message   text,
  decline_reason  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  CHECK (sender_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS match_requests_open_unique
  ON public.match_requests (sender_id, receiver_id)
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS match_requests_receiver_status_idx
  ON public.match_requests (receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS match_requests_sender_status_idx
  ON public.match_requests (sender_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.match_views (
  viewer_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer_id, target_id),
  CHECK (viewer_id <> target_id)
);
CREATE INDEX IF NOT EXISTS match_views_viewer_idx
  ON public.match_views (viewer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chats (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_from_match_id uuid REFERENCES public.match_requests(id) ON DELETE SET NULL,
  last_message_at       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX IF NOT EXISTS chats_user_a_lastmsg_idx
  ON public.chats (user_a_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS chats_user_b_lastmsg_idx
  ON public.chats (user_b_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);
CREATE INDEX IF NOT EXISTS chat_messages_chat_created_idx
  ON public.chat_messages (chat_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.bump_chat_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.chats SET last_message_at = NEW.created_at WHERE id = NEW.chat_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS chat_messages_bump_last ON public.chat_messages;
CREATE TRIGGER chat_messages_bump_last
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_chat_last_message();

CREATE TABLE IF NOT EXISTS public.daily_request_quotas (
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quota_date   date NOT NULL,
  sent_count   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, quota_date)
);
