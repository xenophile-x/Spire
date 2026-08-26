-- Migration unit: track_artists_disambiguation
-- Transaction mode: transactional
-- Boundary reason: default
--
-- Unlimited artist disambiguation + multi-artist tracks:
--   1. artists.provider_id — stable external identity (Apple catalog id,
--      MBID, ...). Nullable: local uploads carry no provider metadata.
--   2. Artist identity becomes (normalized name, provider). Same name under
--      different providers coexist ("John Williams" conductor vs composer);
--      same name with no provider still converges on one row, preserving
--      the dedupe guarantee from 20260825230000.
--   3. track_artists junction — many-to-many with primary/feature billing.
--      tracks.artist_id stays as the denormalized PRIMARY artist so all
--      existing reads (library, search, carousels) keep working untouched.
--   4. Backfill junction from existing tracks.artist_id links.

-- ---------------------------------------------------------------------------
-- 1. Provider identity on artists.
--    Partial unique index: multiple NULL provider_ids are legal, duplicates
--    of a real provider id are not.
-- ---------------------------------------------------------------------------
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS provider_id text;

CREATE UNIQUE INDEX IF NOT EXISTS artists_provider_id_unique
  ON public.artists (provider_id)
  WHERE provider_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Identity key: name x provider.
--    Replaces artists_name_normalized_unique (which made disambiguation
--    impossible by collapsing every same-name artist into one row).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.artists_name_normalized_unique;

CREATE UNIQUE INDEX IF NOT EXISTS artists_name_provider_unique
  ON public.artists (lower(btrim(name)), COALESCE(provider_id, ''));

-- ---------------------------------------------------------------------------
-- 3. Junction table (mirrors favorite_artists conventions).
--    Composite PK blocks linking the same artist twice; CASCADEs keep the
--    table orphan-free when tracks or artists are deleted.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.track_artists (
  track_id   uuid        NOT NULL REFERENCES public.tracks(id)  ON DELETE CASCADE,
  artist_id  uuid        NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  is_primary boolean     NOT NULL DEFAULT true,
  position   integer     NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_track_artists_artist_id
  ON public.track_artists(artist_id);

ALTER TABLE public.track_artists ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.track_artists TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.track_artists TO authenticated, service_role;

CREATE POLICY "Track artists are readable by everyone"
  ON public.track_artists FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users add track artists"
  ON public.track_artists FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users update track artists"
  ON public.track_artists FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users delete track artists"
  ON public.track_artists FOR DELETE
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 4. Backfill: every existing single-artist link becomes the primary row.
-- ---------------------------------------------------------------------------
INSERT INTO public.track_artists (track_id, artist_id, is_primary, position)
SELECT t.id, t.artist_id, true, 1
FROM public.tracks t
WHERE t.artist_id IS NOT NULL
ON CONFLICT (track_id, artist_id) DO NOTHING;
