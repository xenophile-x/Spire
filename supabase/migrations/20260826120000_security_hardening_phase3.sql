-- Migration unit: security_hardening_phase3
-- Transaction mode: transactional
-- Boundary reason: default
--
-- Phase 3 hardening (complements _phase2). Fixes found in the Aug 2026 audit:
--   1. CRITICAL: users.share_token leaked to anon. RLS is row-level only, so
--      any visitor could read share_token + email of every public-library
--      owner via /rest/v1/users?is_library_public=eq.true&select=share_token
--      and stream their libraries without ever receiving a link.
--      -> Move tokens into an owner-private table; expose share-link lookups
--         through a SECURITY DEFINER function that returns id + full_name
--         ONLY, and never the token itself.
--   2. HIGH: trigger SECURITY DEFINER functions had EXECUTE granted to
--      anon/authenticated - anyone could invoke them directly with fabricated
--      payloads and rewrite arbitrary profiles. Trigger firing does not need
--      EXECUTE; revoke it from interactive roles.
--   3. HIGH: library_shares was referenced by RLS policies, the frontend and
--      stream-track, but no migration ever created it (fresh db reset fails;
--      invites depended on an out-of-band table). Create it here with the
--      exact shape the app expects.

-- ---------------------------------------------------------------------------
-- 1a. Dedicated owner-private share-token table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_share_tokens (
  user_id     uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  share_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_share_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own share token" ON public.user_share_tokens;
CREATE POLICY "Owners read own share token"
ON public.user_share_tokens FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners create own share token" ON public.user_share_tokens;
CREATE POLICY "Owners create own share token"
ON public.user_share_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners update own share token" ON public.user_share_tokens;
CREATE POLICY "Owners update own share token"
ON public.user_share_tokens FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.user_share_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.user_share_tokens TO authenticated;

COMMENT ON TABLE public.user_share_tokens IS
  'Owner-private share links. Never exposed to anon; playback is authorized by stream-track via service role.';

-- ---------------------------------------------------------------------------
-- 1b. Backfill existing tokens from the legacy users.share_token column.
--     Idempotent: safe to re-run (also re-run by the follow-up drop migration).
-- ---------------------------------------------------------------------------
INSERT INTO public.user_share_tokens (user_id, share_token)
SELECT id, share_token
FROM public.users
WHERE share_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1c. Share-page lookup for anon visitors: resolve a link token to a minimal
--     public profile. Private/soft-deleted owners return no rows. The token
--     itself is accepted as a parameter and never returned or listable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shared_library_owner(p_token uuid)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.full_name
  FROM public.user_share_tokens tst
  JOIN public.users u ON u.id = tst.user_id
  WHERE tst.share_token = p_token
    AND u.is_library_public = true
    AND u.deleted_at IS NULL
$$;

REVOKE ALL ON FUNCTION public.shared_library_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shared_library_owner(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trigger helpers must not be callable directly. Revoking EXECUTE does not
--    affect trigger firing (privileges are not checked for trigger invokes).
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'handle_new_user',
        'handle_new_google_user',
        'create_default_liked_playlist',
        'set_updated_at',
        'assign_playlist_position'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated;', r.fn_signature);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. library_shares: create the missing table exactly as the app uses it.
--    FK naming matters: useHomeFeed embeds users!library_shares_owner_id_fkey,
--    so owner_id's constraint keeps Postgres' default name.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.library_shares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  grantee_email text NOT NULL,
  grantee_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'pending'
                CONSTRAINT library_shares_status_check CHECK (status IN ('pending','accepted')),
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Fill gaps in case an out-of-band table already exists remotely.
ALTER TABLE public.library_shares ADD COLUMN IF NOT EXISTS grantee_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.library_shares ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.library_shares ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.library_shares ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.library_shares ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.library_shares ENABLE ROW LEVEL SECURITY;

-- Owner: full control over outgoing invites.
DROP POLICY IF EXISTS "Owners view outgoing invites" ON public.library_shares;
CREATE POLICY "Owners view outgoing invites"
ON public.library_shares FOR SELECT
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners create outgoing invites" ON public.library_shares;
CREATE POLICY "Owners create outgoing invites"
ON public.library_shares FOR INSERT
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners update outgoing invites" ON public.library_shares;
CREATE POLICY "Owners update outgoing invites"
ON public.library_shares FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners delete outgoing invites" ON public.library_shares;
CREATE POLICY "Owners delete outgoing invites"
ON public.library_shares FOR DELETE
USING (auth.uid() = owner_id);

-- Invitee: see invites addressed to your email (any status), accept pending
-- ones into accepted (cannot rewrite ownership), decline pending ones.
DROP POLICY IF EXISTS "Invitees view incoming invites" ON public.library_shares;
CREATE POLICY "Invitees view incoming invites"
ON public.library_shares FOR SELECT
USING (
  lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS "Users can accept incoming invites" ON public.library_shares;
CREATE POLICY "Users can accept incoming invites"
ON public.library_shares FOR UPDATE
USING (
  status = 'pending'
  AND lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND (expires_at IS NULL OR expires_at > now())
)
WITH CHECK (
  status = 'accepted'
  AND grantee_id = (SELECT auth.uid())
  AND lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS "Invitees delete incoming invites" ON public.library_shares;
CREATE POLICY "Invitees delete incoming invites"
ON public.library_shares FOR DELETE
USING (
  lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_shares TO authenticated;
REVOKE ALL ON public.library_shares FROM anon;

CREATE INDEX IF NOT EXISTS idx_library_shares_owner_id ON public.library_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_library_shares_grantee_email ON public.library_shares(lower(grantee_email));
CREATE INDEX IF NOT EXISTS idx_library_shares_grantee_id ON public.library_shares(grantee_id);

-- Realtime (LibrarySharing subscribes to postgres_changes on this table).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.library_shares;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already in publication
  WHEN undefined_object THEN NULL;  -- publication not configured
END $$;
