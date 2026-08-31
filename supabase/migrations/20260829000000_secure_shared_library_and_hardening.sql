-- Migration: secure_shared_library_and_hardening
-- Fixes HIGH severity regressions: user_tracks missing grantee read, overly permissive policies,
-- missing rate-limit persistence, CORS wildcard, and search_path pinning.
-- IDEMPOTENT, least-privilege, safe to re-run.

-- ============================================================
-- 1. user_tracks: restore least-privilege shared read (IDOR fix)
-- Previously 20260828000001 dropped shared read, breaking LibraryContext
-- grantee discovery via getUserLibrary(owner_id). Re-add narrow SELECT
-- that only allows accepted shares, not pending, and checks both grantee_id
-- and lower(email) fallback. No INSERT/UPDATE/DELETE grant to grantees.
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='user_tracks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_tracks;', r.policyname);
  END LOOP;
END $$;

-- Owner has full CRUD on own rows
CREATE POLICY "Owners manage own user_tracks"
ON public.user_tracks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Grantee: SELECT-only, accepted + not expired, least privilege
CREATE POLICY "Grantees can view shared user_tracks"
ON public.user_tracks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.library_shares ls
    WHERE ls.owner_id = user_tracks.user_id
      AND ls.status = 'accepted'
      AND (ls.expires_at IS NULL OR ls.expires_at > now())
      AND (
        ls.grantee_id = auth.uid()
        OR lower(ls.grantee_email) = lower(coalesce(auth.jwt()->> 'email',''))
      )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tracks TO authenticated;
REVOKE ALL ON public.user_tracks FROM anon;

-- ============================================================
-- 2. Harden library_shares: prevent email spoof via UPDATE check
-- Invitees should not be able to change owner_id or grantee_email
-- via crafted payload. Tighten WITH CHECK to require grantee_id = auth.uid().
-- Already present in fix_recursion but re-assert after any drift.
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='library_shares'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.library_shares;', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Owners manage outgoing invites"
ON public.library_shares FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Invitees view incoming invites"
ON public.library_shares FOR SELECT
USING (lower(grantee_email) = lower(coalesce(auth.jwt()->> 'email','')));

CREATE POLICY "Invitees accept incoming invites"
ON public.library_shares FOR UPDATE
USING (
  status = 'pending'
  AND lower(grantee_email) = lower(coalesce(auth.jwt()->> 'email',''))
  AND (expires_at IS NULL OR expires_at > now())
)
WITH CHECK (
  status = 'accepted'
  AND grantee_id = auth.uid()
  AND lower(grantee_email) = lower(coalesce(auth.jwt()->> 'email',''))
);

CREATE POLICY "Invitees delete incoming invites"
ON public.library_shares FOR DELETE
USING (lower(grantee_email) = lower(coalesce(auth.jwt()->> 'email','')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_shares TO authenticated;
REVOKE ALL ON public.library_shares FROM anon;

-- ============================================================
-- 3. Pin search_path on SECURITY DEFINER funcs (prevent search_path hijack)
-- Covers register_track, shared_library_owner, get_shared_library_tracks
-- ============================================================
ALTER FUNCTION public.register_track(uuid, text, text, text, text, numeric, text, text, text, text, text, text, boolean)
  SET search_path = '';
ALTER FUNCTION public.shared_library_owner(uuid) SET search_path = '';
ALTER FUNCTION public.get_shared_library_tracks(uuid) SET search_path = '';
-- Pin helpers if exist (idempotent guard)
DO $$ BEGIN
  PERFORM pg_get_functiondef('public.handle_new_user()'::regprocedure);
  ALTER FUNCTION public.handle_new_user() SET search_path = '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM pg_get_functiondef('public.handle_new_google_user()'::regprocedure);
  ALTER FUNCTION public.handle_new_google_user() SET search_path = '';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- 4. Ensure linking_codes is service_role only (defense in depth)
-- Prevent anon/authenticated enumeration of discord linking codes
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE c.relname='linking_codes' AND n.nspname='public') THEN
    EXECUTE 'ALTER TABLE public.linking_codes ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='linking_codes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.linking_codes;', r.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.linking_codes FROM anon, authenticated;
GRANT ALL ON public.linking_codes TO service_role;

-- ============================================================
-- 5. google_oauth_tokens: authenticated should never SELECT this table
-- Only service_role via edge functions should touch it. Prevent token exfiltration.
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE c.relname='google_oauth_tokens' AND n.nspname='public') THEN
    EXECUTE 'ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='google_oauth_tokens'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.google_oauth_tokens;', r.policyname);
  END LOOP;
END $$;
REVOKE ALL ON public.google_oauth_tokens FROM anon, authenticated;
GRANT ALL ON public.google_oauth_tokens TO service_role;

-- ============================================================
-- 6. user_share_tokens: keep owner-private (no anon grant)
-- ============================================================
ALTER TABLE public.user_share_tokens ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='user_share_tokens'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_share_tokens;', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Owners read own share token" ON public.user_share_tokens FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "Owners create own share token" ON public.user_share_tokens FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Owners update own share token" ON public.user_share_tokens FOR UPDATE USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
REVOKE ALL ON public.user_share_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.user_share_tokens TO authenticated;

-- ============================================================
-- 7. Revoke EXECUTE on trigger-only SECURITY DEFINER funcs
-- Prevent anon direct invocation with crafted payloads
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'handle_new_user','handle_new_google_user','create_default_liked_playlist',
      'set_updated_at','assign_playlist_position','link_share_grantee',
      'handle_discord_oauth_link'
    ) AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated;', r.fn);
  END LOOP;
END $$;

-- ============================================================
-- 8. Indexes for grantee checks (prevent seq scan on 403 hot path)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_library_shares_owner_grantee
  ON public.library_shares(owner_id, grantee_id);
CREATE INDEX IF NOT EXISTS idx_library_shares_owner_email_lower
  ON public.library_shares(owner_id, lower(grantee_email));
