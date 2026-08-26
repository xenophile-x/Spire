-- Migration unit: rls_and_constraint_fixes
-- Transaction mode: transactional
-- Boundary reason: default
--
-- Fixes four schema/RLS gaps found reviewing the live schema against app code:
--   1. track_metadata / track_lyrics upserts fail (INSERT-only RLS, no UPDATE).
--   2. No unique constraint on tracks(canonical_title, canonical_artist)
--      (registerTrackInSupabase's 23505 race handling can never fire).
--   3. No unique constraint on user_tracks(user_id, track_id)
--      (re-uploads silently duplicate rows).
--   4. HomeFeed owner-profile embedding returns null under the users RLS
--      policy unless the owner's whole library is public.
--   5. library_shares accept policy lacks a pending-status guard / WITH CHECK.

-- ---------------------------------------------------------------------------
-- 1a. Allow authenticated users to update canonical metadata/lyrics.
--     Matches the INSERT semantics already granted ("auth.role() = 'authenticated'").
-- ---------------------------------------------------------------------------
CREATE POLICY "Auth users update metadata"
ON public.track_metadata FOR UPDATE
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Auth users update lyrics"
ON public.track_lyrics FOR UPDATE
USING (auth.role() = 'authenticated'::text);

-- ---------------------------------------------------------------------------
-- 2. Unique canonical identity for tracks. Deduplicate first (keep oldest row),
--    re-pointing dependent rows at the survivor, then constrain.
-- ---------------------------------------------------------------------------
WITH dups AS (
  SELECT
    id,
    (canonical_title || '::' || canonical_artist) AS key,
    first_value(id) OVER (
      PARTITION BY canonical_title, canonical_artist
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM public.tracks
)
UPDATE public.user_tracks ut
SET track_id = dups.keep_id
FROM dups
WHERE ut.track_id = dups.id AND dups.keep_id <> dups.id;

WITH dups AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY canonical_title, canonical_artist
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM public.tracks
)
DELETE FROM public.track_metadata tm
USING dups
WHERE tm.track_id = dups.id AND dups.keep_id <> dups.id;

WITH dups AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY canonical_title, canonical_artist
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM public.tracks
)
DELETE FROM public.track_lyrics tl
USING dups
WHERE tl.track_id = dups.id AND dups.keep_id <> dups.id;

WITH dups AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY canonical_title, canonical_artist
      ORDER BY created_at ASC, id ASC
    ) AS keep_id
  FROM public.tracks
)
DELETE FROM public.tracks t
USING dups
WHERE t.id = dups.id AND dups.keep_id <> dups.id;

-- Backfill artist_id linkage is intentionally NOT merged here — artist links
-- are advisory metadata; surviving rows keep theirs.
ALTER TABLE public.tracks
  ADD CONSTRAINT tracks_canonical_identity_unique
  UNIQUE (canonical_title, canonical_artist);

-- ---------------------------------------------------------------------------
-- 3. One row per (user, track) in personal libraries. Deduplicate, then constrain.
-- ---------------------------------------------------------------------------
WITH dups AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY user_id, track_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keep_id
  FROM public.user_tracks
)
DELETE FROM public.user_tracks ut
USING dups
WHERE ut.id = dups.id AND dups.keep_id <> dups.id;

ALTER TABLE public.user_tracks
  ADD CONSTRAINT user_tracks_user_track_unique
  UNIQUE (user_id, track_id);

-- ---------------------------------------------------------------------------
-- 4. Let sharing partners see the owner's profile (full_name/email) without
--    requiring the owner's entire library to be public.
-- ---------------------------------------------------------------------------
DROP POLICY "Public read user profiles with shared libraries" ON public.users;
CREATE POLICY "Public read user profiles with shared libraries"
ON public.users FOR SELECT
USING (
  is_library_public = true
  OR auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.library_shares ls
    WHERE ls.owner_id = users.id
      AND ls.grantee_id = auth.uid()
      AND ls.status = 'accepted'
      AND (ls.expires_at IS NULL OR ls.expires_at > now())
  )
);

-- ---------------------------------------------------------------------------
-- 5. Tighten invite acceptance: only pending invites, addressed to you,
--    and the grantee cannot rewrite ownership columns.
-- ---------------------------------------------------------------------------
DROP POLICY "Users can accept incoming invites" ON public.library_shares;
CREATE POLICY "Users can accept incoming invites"
ON public.library_shares FOR UPDATE
USING (
  status = 'pending'
  AND grantee_email = (
    SELECT u.email FROM public.users u WHERE u.id = auth.uid()
  )
)
WITH CHECK (
  status = 'accepted'
  AND grantee_email = (
    SELECT u.email FROM public.users u WHERE u.id = auth.uid()
  )
  AND grantee_id = auth.uid()
);
