-- Migration unit: artists_itunes_artist_id
-- Transaction mode: transactional
-- Boundary reason: default
--
-- Entity-based artist resolution: tracks matched on iTunes carry the
-- provider's stable artistId. Artists keyed by that ID survive renames
-- ("Kanye West" -> "Ye") and stop depending on exact string matching as
-- the only merge key.
--
-- Nullable + partially unique: legacy rows keep NULL until an upload that
-- resolves to them (by name) stamps its ID.

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS itunes_artist_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS artists_itunes_artist_id_key
  ON public.artists (itunes_artist_id)
  WHERE itunes_artist_id IS NOT NULL;

-- Uploads stamp the ID onto name-matched rows (same anti-vandalism posture
-- as photo_url/bio: column-scoped grant, everything else stays locked).
GRANT UPDATE (photo_url, bio, itunes_artist_id) ON TABLE public.artists TO authenticated;
