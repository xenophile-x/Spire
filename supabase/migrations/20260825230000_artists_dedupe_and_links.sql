-- Migration unit: artists_dedupe_and_links
-- Transaction mode: transactional
-- Boundary reason: default
--
-- Artists fixes:
--   1. Merge duplicate artist rows (case/whitespace variants each carried
--      their own photo). Survivor = row that has a photo, else oldest.
--      tracks.artist_id and favorite_artists.artist_id are re-pointed.
--   2. Enforce uniqueness on normalized (lower, trimmed) name.
--   3. Link orphan tracks to artist rows case-insensitively, creating any
--      missing artist rows, so every carousel entry can carry a photo.
--   4. Allow authenticated users to set tracks.artist_id (column-scoped) so
--      uploads can link artists going forward (see registerTrackInSupabase).

-- ---------------------------------------------------------------------------
-- 1. Merge duplicates (keep photo-carrying row, else oldest).
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY lower(btrim(name))
           ORDER BY (photo_url IS NOT NULL) DESC, created_at ASC, id ASC
         ) AS keep_id
  FROM public.artists
)
UPDATE public.favorite_artists fa
SET artist_id = ranked.keep_id
FROM ranked
WHERE fa.artist_id = ranked.id AND ranked.keep_id <> ranked.id;

WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY lower(btrim(name))
           ORDER BY (photo_url IS NOT NULL) DESC, created_at ASC, id ASC
         ) AS keep_id
  FROM public.artists
)
UPDATE public.tracks t
SET artist_id = ranked.keep_id
FROM ranked
WHERE t.artist_id = ranked.id AND ranked.keep_id <> ranked.id;

WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY lower(btrim(name))
           ORDER BY (photo_url IS NOT NULL) DESC, created_at ASC, id ASC
         ) AS keep_id
  FROM public.artists
)
DELETE FROM public.artists a
USING ranked
WHERE a.id = ranked.id AND ranked.keep_id <> ranked.id;

-- Normalize survivor names so exact-name inserts converge on one row.
UPDATE public.artists
SET name = btrim(name)
WHERE name <> btrim(name);

-- ---------------------------------------------------------------------------
-- 2. Normalized uniqueness.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS artists_name_normalized_unique
  ON public.artists (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- 3. Link orphan tracks (case-insensitive), creating missing artists.
--    ON CONFLICT DO NOTHING (no target) also absorbs normalized-index races.
-- ---------------------------------------------------------------------------
WITH new_artists AS (
  INSERT INTO public.artists (name)
  SELECT DISTINCT btrim(canonical_artist)
  FROM public.tracks
  WHERE artist_id IS NULL
    AND canonical_artist IS NOT NULL
    AND btrim(canonical_artist) <> ''
    AND lower(btrim(canonical_artist)) NOT IN ('unknown', 'unknown artist')
  ON CONFLICT DO NOTHING
  RETURNING name
)
UPDATE public.tracks t
SET artist_id = a.id
FROM public.artists a
WHERE t.artist_id IS NULL
  AND lower(btrim(a.name)) = lower(btrim(t.canonical_artist));

-- ---------------------------------------------------------------------------
-- 4. Column-scoped UPDATE so uploads can link artists (policy mirrors the
--    metadata/lyrics semantics already granted to authenticated users).
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON TABLE public.tracks FROM anon, authenticated;
GRANT UPDATE (artist_id) ON TABLE public.tracks TO authenticated;

DROP POLICY IF EXISTS "Auth users update tracks" ON public.tracks;
CREATE POLICY "Auth users update tracks"
ON public.tracks FOR UPDATE
USING (auth.role() = 'authenticated'::text);
