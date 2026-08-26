-- Migration unit: security_hardening_phase2
-- Transaction mode: transactional
-- Boundary reason: default
--
-- Phase 2 hardening (complements 20260825000000_rls_and_constraint_fixes.sql):
--   1. Ensure RLS is ENABLED on every public table (policies are inert otherwise).
--   2. Hide soft-deleted profiles (users.deleted_at was ignored by RLS).
--   3. Unique constraints for liked_songs / favorite_artists (toggle endpoints race).
--   4. playlist_tracks: real positions + uniques (every row defaulted to 1,
--      so addTrackToPlaylist silently dropped tracks and duplicates accumulated).
--   5. google_oauth_tokens: browser can no longer READ tokens back
--      (XSS exfiltration vector). INSERT/UPDATE remain for login persistence;
--      edge functions keep service-role access.
--   6. user_tracks: drop the anon-readable "public library" policy (it exposed
--      drive_file_id to the whole internet) and replace listing access with a
--      SECURITY DEFINER view that omits drive_file_id entirely.
--   7. artists: authenticated updates restricted to photo_url only (was: full-row
--      edits of any artist by any user).

-- ---------------------------------------------------------------------------
-- 1. Enable RLS everywhere in public.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.relname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Soft-deleted profiles disappear from public/share reads.
--    deleted_at may not exist yet on older projects - create it first.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP POLICY IF EXISTS "Public read user profiles with shared libraries" ON public.users;
CREATE POLICY "Public read user profiles with shared libraries"
ON public.users FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    is_library_public = true
    OR auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.library_shares ls
      WHERE ls.owner_id = users.id
        AND ls.grantee_id = (SELECT auth.uid())
        AND ls.status = 'accepted'
        AND (ls.expires_at IS NULL OR ls.expires_at > now())
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2b. Invite acceptance: case-insensitive email match, expiry-checked,
--     pending-only transitions into accepted rows owned by the granter.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3a. liked_songs: dedupe (keep oldest row), then constrain.
-- ---------------------------------------------------------------------------
DELETE FROM public.liked_songs a
USING public.liked_songs b
WHERE a.user_id = b.user_id
  AND a.track_id = b.track_id
  AND a.ctid > b.ctid;

ALTER TABLE public.liked_songs
  ADD CONSTRAINT liked_songs_user_track_unique UNIQUE (user_id, track_id);

-- ---------------------------------------------------------------------------
-- 3b. favorite_artists: dedupe (keep oldest row), then constrain.
-- ---------------------------------------------------------------------------
DELETE FROM public.favorite_artists a
USING public.favorite_artists b
WHERE a.user_id = b.user_id
  AND a.artist_id = b.artist_id
  AND a.ctid > b.ctid;

ALTER TABLE public.favorite_artists
  ADD CONSTRAINT favorite_artists_user_artist_unique UNIQUE (user_id, artist_id);

-- ---------------------------------------------------------------------------
-- 4. playlist_tracks: compact positions, assign slots on insert, constrain.
--    The client omits position on insert, so a BEFORE INSERT trigger picks
--    max(position)+1 instead of the old constant DEFAULT 1.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT playlist_id, track_id,
         ROW_NUMBER() OVER (
           PARTITION BY playlist_id
           ORDER BY added_at ASC NULLS LAST, track_id ASC
         ) AS new_pos
  FROM public.playlist_tracks
)
UPDATE public.playlist_tracks pt
SET position = ranked.new_pos
FROM ranked
WHERE pt.playlist_id = ranked.playlist_id
  AND pt.track_id = ranked.track_id;

ALTER TABLE public.playlist_tracks
  ADD CONSTRAINT playlist_tracks_position_unique UNIQUE (playlist_id, position);

DELETE FROM public.playlist_tracks a
USING public.playlist_tracks b
WHERE a.playlist_id = b.playlist_id
  AND a.track_id = b.track_id
  AND a.ctid > b.ctid;

ALTER TABLE public.playlist_tracks
  ADD CONSTRAINT playlist_tracks_playlist_track_unique UNIQUE (playlist_id, track_id);

CREATE OR REPLACE FUNCTION public.assign_playlist_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.position IS NULL OR NEW.position <= 0 THEN
    SELECT COALESCE(MAX(pt.position), 0) + 1 INTO NEW.position
    FROM public.playlist_tracks pt
    WHERE pt.playlist_id = NEW.playlist_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_playlist_tracks_assign_position
BEFORE INSERT ON public.playlist_tracks
FOR EACH ROW EXECUTE FUNCTION public.assign_playlist_position();

-- ---------------------------------------------------------------------------
-- 5. google_oauth_tokens: revoke browser reads. The client never selects this
--    table (tokens flow from the auth session); edge functions use service
--    role, which bypasses RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own oauth token" ON public.google_oauth_tokens;

-- ---------------------------------------------------------------------------
-- 6a. user_tracks: close the anonymous listing hole.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read user_tracks from shared libraries" ON public.user_tracks;

-- ---------------------------------------------------------------------------
-- 6b. Safe public listing: same metadata the share page shows, minus
--     drive_file_id (and gated on non-deleted owners). Definer rights let
--     anonymous visitors list rows without any base-table grant; playback
--     still goes through stream-track, which now requires the share token.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.shared_library_tracks AS
SELECT
  ut.id,
  ut.user_id                                   AS owner_id,
  ut.uploaded_filename,
  ut.created_at,
  t.id                                         AS track_id,
  t.canonical_title,
  t.canonical_artist,
  t.duration_seconds,
  tm.album_name,
  tm.artwork_url,
  tm.primary_genre,
  tl.synced_lyrics,
  tl.plain_lyrics
FROM public.user_tracks ut
JOIN public.users u
  ON u.id = ut.user_id
LEFT JOIN public.tracks t
  ON t.id = ut.track_id
LEFT JOIN public.track_metadata tm
  ON tm.track_id = t.id
LEFT JOIN public.track_lyrics tl
  ON tl.track_id = t.id
WHERE u.is_library_public = true
  AND u.deleted_at IS NULL;

GRANT SELECT ON public.shared_library_tracks TO anon, authenticated;

COMMENT ON VIEW public.shared_library_tracks IS
  'Public listing for share-link pages. Deliberately excludes drive_file_id; streaming is authorized by stream-track against users.share_token.';

-- ---------------------------------------------------------------------------
-- 7. artists: keep the crowdsourced photo feature, kill full-row vandalism.
--    The existing UPDATE policy still gates *which rows*; column grants now
--    limit *which fields* an authenticated user can touch.
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON TABLE public.artists FROM anon, authenticated;
GRANT UPDATE (photo_url) ON TABLE public.artists TO authenticated;
