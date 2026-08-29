-- Migration unit: security_remediation
-- Transaction mode: transactional
-- Boundary reason: default
--
-- Comprehensive security and performance remediation based on 2026-08-28 audit.
-- Addresses: CRITICAL shared_library_tracks IDOR, HIGH search_path/EXECUTE issues,
-- MEDIUM duplicate RLS policies, missing indexes, and transactional track registration.
-- IDEMPOTENT: Safe to run multiple times.

-- ============================================================
-- 1. CRITICAL: Replace shared_library_tracks SECURITY DEFINER view with
--    a parameterized function that validates share_token on every call.
-- ============================================================

-- Drop the insecure view first
DROP VIEW IF EXISTS public.shared_library_tracks;

-- Create a secure function that requires the share_token and validates
-- is_library_public on every invocation (no IDOR possible)
CREATE OR REPLACE FUNCTION public.get_shared_library_tracks(p_token uuid)
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  uploaded_filename text,
  created_at timestamptz,
  track_id uuid,
  canonical_title text,
  canonical_artist text,
  duration_seconds numeric,
  album_name text,
  artwork_url text,
  primary_genre text,
  synced_lyrics text,
  plain_lyrics text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    ut.id,
    ut.user_id AS owner_id,
    ut.uploaded_filename,
    ut.created_at,
    t.id AS track_id,
    t.canonical_title,
    t.canonical_artist,
    t.duration_seconds,
    tm.album_name,
    tm.artwork_url,
    tm.primary_genre,
    tl.synced_lyrics,
    tl.plain_lyrics
  FROM public.user_share_tokens ust
  JOIN public.users u ON u.id = ust.user_id
  JOIN public.user_tracks ut ON ut.user_id = ust.user_id
  JOIN public.tracks t ON t.id = ut.track_id
  LEFT JOIN public.track_metadata tm ON tm.track_id = t.id
  LEFT JOIN public.track_lyrics tl ON tl.track_id = t.id
  WHERE ust.share_token = p_token
    AND u.is_library_public = true
    AND u.deleted_at IS NULL
$$;

REVOKE ALL ON FUNCTION public.get_shared_library_tracks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_library_tracks(uuid) TO anon, authenticated;

-- ============================================================
-- 2. HIGH: Revoke EXECUTE on trigger-only SECURITY DEFINER functions from
--    anon/authenticated. These should only fire via triggers, not RPC.
-- ============================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'handle_new_user',
        'handle_new_google_user',
        'create_default_liked_playlist',
        'set_updated_at',
        'handle_discord_oauth_link',
        'assign_playlist_position',
        'link_share_grantee'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated;', r.fn_signature);
  END LOOP;
END $$;

-- shared_library_owner is intentionally callable by anon (used by share page)
-- Keep its EXECUTE grant but ensure search_path is pinned (done in phase3)

-- ============================================================
-- 3. HIGH: Pin search_path = '' on all SECURITY DEFINER functions to prevent
--    search_path hijacking privilege escalation.
-- ============================================================

ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.create_default_liked_playlist() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.link_share_grantee() SET search_path = '';
ALTER FUNCTION public.handle_new_google_user() SET search_path = '';
ALTER FUNCTION public.handle_discord_oauth_link() SET search_path = '';
ALTER FUNCTION public.assign_playlist_position() SET search_path = '';
ALTER FUNCTION public.shared_library_owner(uuid) SET search_path = '';
ALTER FUNCTION public.get_shared_library_tracks(uuid) SET search_path = '';

-- ============================================================
-- 4. MEDIUM: Consolidate duplicate/overlapping RLS policies.
--    Drop ALL existing policies first, then recreate clean ones.
-- ============================================================

-- 4a. users: Drop all and recreate
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Public read user profiles with shared libraries"
ON public.users FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    is_library_public = true
    OR auth.uid() = id
  )
);

CREATE POLICY "Users can manage their own profile"
ON public.users FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4b. playlists: Drop all and recreate clean
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'playlists'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Users can read own or shared playlists"
ON public.playlists FOR SELECT
USING (
  auth.uid() = user_id
  OR is_public = true
  OR EXISTS (
    SELECT 1 FROM public.library_shares ls
    WHERE ls.grantee_id = auth.uid()
      AND ls.status = 'accepted'
      AND (ls.expires_at IS NULL OR ls.expires_at > now())
  )
);

CREATE POLICY "Users insert own playlists"
ON public.playlists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own playlists"
ON public.playlists FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own playlists"
ON public.playlists FOR DELETE
USING (auth.uid() = user_id);

-- 4c. user_tracks: Drop ALL and recreate
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_tracks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Users manage own user_tracks"
ON public.user_tracks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4d. track_metadata/track_lyrics: Drop ALL and recreate
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('track_metadata', 'track_lyrics')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Anyone can view metadata" ON public.track_metadata FOR SELECT USING (true);
CREATE POLICY "Anyone can view lyrics" ON public.track_lyrics FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert metadata" ON public.track_metadata FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can insert lyrics" ON public.track_lyrics FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update metadata" ON public.track_metadata FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update lyrics" ON public.track_lyrics FOR UPDATE USING (auth.role() = 'authenticated');

-- 4e. library_shares: Drop all and recreate clean (also done in fix_recursion but idempotent here)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_shares'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Owners manage outgoing invites"
ON public.library_shares FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Invitees view incoming invites"
ON public.library_shares FOR SELECT
USING (lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Invitees accept incoming invites"
ON public.library_shares FOR UPDATE
USING (
  status = 'pending'
  AND lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND (expires_at IS NULL OR expires_at > now())
)
WITH CHECK (
  status = 'accepted'
  AND grantee_id = auth.uid()
  AND lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

CREATE POLICY "Invitees delete incoming invites"
ON public.library_shares FOR DELETE
USING (lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 4f. tracks/artists: Drop ALL and recreate
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('tracks', 'artists')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Anyone can view tracks" ON public.tracks FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert tracks" ON public.tracks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update tracks" ON public.tracks FOR UPDATE USING (auth.role() = 'authenticated');

-- Note: artists UPDATE restricted to photo_url via column grant (phase2)

-- ============================================================
-- 5. MEDIUM: Create transactional RPC for track registration
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_track(
  p_user_id uuid,
  p_drive_file_id text,
  p_filename text,
  p_title text,
  p_artist text,
  p_duration_seconds numeric,
  p_itunes_artist_id text DEFAULT NULL,
  p_itunes_track_id text DEFAULT NULL,
  p_artwork_url text DEFAULT NULL,
  p_primary_genre text DEFAULT NULL,
  p_synced_lyrics text DEFAULT NULL,
  p_plain_lyrics text DEFAULT NULL,
  p_is_synced boolean DEFAULT false
)
RETURNS public.user_tracks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_artist_id uuid;
  v_track_id uuid;
  v_user_track public.user_tracks;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized: user_id mismatch';
  END IF;

  IF p_artist IS NOT NULL AND lower(btrim(p_artist)) NOT IN ('unknown', 'unknown artist', '') THEN
    IF p_itunes_artist_id IS NOT NULL THEN
      SELECT id INTO v_artist_id FROM public.artists WHERE provider_id = p_itunes_artist_id LIMIT 1;
    END IF;
    IF v_artist_id IS NULL THEN
      SELECT id INTO v_artist_id FROM public.artists WHERE lower(btrim(name)) = lower(btrim(p_artist)) LIMIT 1;
    END IF;
    IF v_artist_id IS NULL THEN
      INSERT INTO public.artists (name, provider_id)
      VALUES (btrim(p_artist), p_itunes_artist_id)
      ON CONFLICT (lower(btrim(name))) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_artist_id;
    END IF;
  END IF;

  SELECT id INTO v_track_id
  FROM public.tracks
  WHERE lower(canonical_title) = lower(btrim(p_title))
    AND lower(canonical_artist) = lower(btrim(p_artist))
  LIMIT 1;

  IF v_track_id IS NULL THEN
    INSERT INTO public.tracks (canonical_title, canonical_artist, duration_seconds, artist_id)
    VALUES (btrim(p_title), btrim(p_artist), p_duration_seconds, v_artist_id)
    ON CONFLICT (canonical_title, canonical_artist) DO NOTHING
    RETURNING id INTO v_track_id;
    IF v_track_id IS NULL THEN
      SELECT id INTO v_track_id
      FROM public.tracks
      WHERE lower(canonical_title) = lower(btrim(p_title))
        AND lower(canonical_artist) = lower(btrim(p_artist))
      LIMIT 1;
    END IF;
  END IF;

  IF v_track_id IS NOT NULL AND v_artist_id IS NOT NULL THEN
    INSERT INTO public.track_artists (track_id, artist_id, is_primary, position)
    VALUES (v_track_id, v_artist_id, true, 1)
    ON CONFLICT (track_id, artist_id) DO NOTHING;
  END IF;

  IF v_track_id IS NOT NULL THEN
    INSERT INTO public.track_metadata (track_id, artwork_url, primary_genre)
    VALUES (v_track_id, p_artwork_url, p_primary_genre)
    ON CONFLICT (track_id) DO UPDATE
      SET artwork_url = COALESCE(EXCLUDED.artwork_url, public.track_metadata.artwork_url),
          primary_genre = COALESCE(EXCLUDED.primary_genre, public.track_metadata.primary_genre);
  END IF;

  IF v_track_id IS NOT NULL AND (p_synced_lyrics IS NOT NULL OR p_plain_lyrics IS NOT NULL) THEN
    INSERT INTO public.track_lyrics (track_id, synced_lyrics, plain_lyrics, is_synced)
    VALUES (v_track_id, p_synced_lyrics, p_plain_lyrics, p_is_synced)
    ON CONFLICT (track_id) DO UPDATE
      SET synced_lyrics = EXCLUDED.synced_lyrics,
          plain_lyrics = EXCLUDED.plain_lyrics,
          is_synced = EXCLUDED.is_synced;
  END IF;

  IF v_track_id IS NOT NULL THEN
    INSERT INTO public.user_tracks (user_id, track_id, drive_file_id, uploaded_filename)
    VALUES (p_user_id, v_track_id, p_drive_file_id, p_filename)
    ON CONFLICT (user_id, track_id) DO UPDATE
      SET uploaded_filename = EXCLUDED.uploaded_filename,
          drive_file_id = EXCLUDED.drive_file_id
    RETURNING * INTO v_user_track;
  END IF;

  RETURN v_user_track;
END;
$$;

REVOKE ALL ON FUNCTION public.register_track FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_track TO authenticated;

-- ============================================================
-- 6. MEDIUM: Add missing foreign key indexes for query performance.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_tracks_user_id ON public.user_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tracks_track_id ON public.user_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_user_created ON public.listening_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liked_songs_user_id ON public.liked_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON public.playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON public.playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON public.playlist_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_library_shares_owner_id ON public.library_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_library_shares_grantee_id ON public.library_shares(grantee_id);
CREATE INDEX IF NOT EXISTS idx_library_shares_grantee_email_lower ON public.library_shares(lower(grantee_email));
CREATE INDEX IF NOT EXISTS idx_favorite_artists_user_id ON public.favorite_artists(user_id);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist_id ON public.track_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON public.tracks(artist_id);
-- recommendations table may not exist - skip index if so
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'recommendations' AND n.nspname = 'public') THEN
    CREATE INDEX IF NOT EXISTS idx_recommendations_source_track ON public.recommendations(source_track_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_linking_codes_discord_id ON public.linking_codes(discord_id);
CREATE INDEX IF NOT EXISTS idx_linking_codes_code ON public.linking_codes(code);

-- ============================================================
-- 7. MEDIUM: Add functional index for case-insensitive exact dedupe lookups
--    and trigram indexes for wildcard search performance.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tracks_title_artist_lower
  ON public.tracks (lower(canonical_title), lower(canonical_artist));

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm
  ON public.tracks USING gin (canonical_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_trgm
  ON public.tracks USING gin (canonical_artist gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm
  ON public.artists USING gin (name gin_trgm_ops);

-- ============================================================
-- 8. LOW: Ensure linking_codes has RLS enabled with zero policies
--     (service_role only access) - defense in depth.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'linking_codes' AND n.nspname = 'public' AND c.relrowsecurity
  ) THEN
    ALTER TABLE public.linking_codes ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can read own linking codes" ON public.linking_codes;
DROP POLICY IF EXISTS "Users can delete own linking codes" ON public.linking_codes;

REVOKE ALL ON public.linking_codes FROM anon, authenticated;
GRANT ALL ON public.linking_codes TO service_role;

-- ============================================================
-- 9. LOW: Drop unused recommendations table (no code references it)
-- ============================================================

-- Table may not exist (already dropped or never created)
DROP TABLE IF EXISTS public.recommendations CASCADE;