-- Migration: Fix register_track ON CONFLICT target for artists table
-- Problem: register_track used ON CONFLICT (lower(btrim(name))) which matched
--   artists_name_normalized_unique. That index was DROPPED in migration
--   20260826150000_track_artists_disambiguation.sql and replaced with
--   artists_name_provider_unique ON (lower(btrim(name)), COALESCE(provider_id, '')).
--   The stale conflict target caused every song upload to fail with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"

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

  -- -------------------------------------------------------------------------
  -- Resolve / create artist
  -- -------------------------------------------------------------------------
  IF p_artist IS NOT NULL AND lower(btrim(p_artist)) NOT IN ('unknown', 'unknown artist', '') THEN

    -- 1. Prefer a match on stable provider id (iTunes artist id)
    IF p_itunes_artist_id IS NOT NULL THEN
      SELECT id INTO v_artist_id
      FROM public.artists
      WHERE provider_id = p_itunes_artist_id
      LIMIT 1;
    END IF;

    -- 2. Fall back to name-only lookup
    IF v_artist_id IS NULL THEN
      SELECT id INTO v_artist_id
      FROM public.artists
      WHERE lower(btrim(name)) = lower(btrim(p_artist))
        AND (provider_id IS NULL OR provider_id = COALESCE(p_itunes_artist_id, provider_id))
      LIMIT 1;
    END IF;

    -- 3. Insert a new artist row, resolving conflicts against the composite
    --    index artists_name_provider_unique:
    --      (lower(btrim(name)), COALESCE(provider_id, ''))
    --    This is the index that replaced artists_name_normalized_unique in
    --    migration 20260826150000.
    IF v_artist_id IS NULL THEN
      INSERT INTO public.artists (name, provider_id)
      VALUES (btrim(p_artist), p_itunes_artist_id)
      ON CONFLICT (lower(btrim(name)), COALESCE(provider_id, ''))
        DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO v_artist_id;
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- Resolve / create track
  -- -------------------------------------------------------------------------
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

    -- Race: another session won the insert; re-fetch
    IF v_track_id IS NULL THEN
      SELECT id INTO v_track_id
      FROM public.tracks
      WHERE lower(canonical_title) = lower(btrim(p_title))
        AND lower(canonical_artist) = lower(btrim(p_artist))
      LIMIT 1;
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- Link artist -> track in junction table
  -- -------------------------------------------------------------------------
  IF v_track_id IS NOT NULL AND v_artist_id IS NOT NULL THEN
    INSERT INTO public.track_artists (track_id, artist_id, is_primary, position)
    VALUES (v_track_id, v_artist_id, true, 1)
    ON CONFLICT (track_id, artist_id) DO NOTHING;
  END IF;

  -- -------------------------------------------------------------------------
  -- Upsert track metadata
  -- -------------------------------------------------------------------------
  IF v_track_id IS NOT NULL THEN
    INSERT INTO public.track_metadata (track_id, artwork_url, primary_genre)
    VALUES (v_track_id, p_artwork_url, p_primary_genre)
    ON CONFLICT (track_id) DO UPDATE
      SET artwork_url   = COALESCE(EXCLUDED.artwork_url,   public.track_metadata.artwork_url),
          primary_genre = COALESCE(EXCLUDED.primary_genre, public.track_metadata.primary_genre);
  END IF;

  -- -------------------------------------------------------------------------
  -- Upsert lyrics
  -- -------------------------------------------------------------------------
  IF v_track_id IS NOT NULL AND (p_synced_lyrics IS NOT NULL OR p_plain_lyrics IS NOT NULL) THEN
    INSERT INTO public.track_lyrics (track_id, synced_lyrics, plain_lyrics, is_synced)
    VALUES (v_track_id, p_synced_lyrics, p_plain_lyrics, p_is_synced)
    ON CONFLICT (track_id) DO UPDATE
      SET synced_lyrics = EXCLUDED.synced_lyrics,
          plain_lyrics  = EXCLUDED.plain_lyrics,
          is_synced     = EXCLUDED.is_synced;
  END IF;

  -- -------------------------------------------------------------------------
  -- Upsert user_tracks (one row per user x track)
  -- -------------------------------------------------------------------------
  IF v_track_id IS NOT NULL THEN
    INSERT INTO public.user_tracks (user_id, track_id, drive_file_id, uploaded_filename)
    VALUES (p_user_id, v_track_id, p_drive_file_id, p_filename)
    ON CONFLICT (user_id, track_id) DO UPDATE
      SET uploaded_filename = EXCLUDED.uploaded_filename,
          drive_file_id     = EXCLUDED.drive_file_id
    RETURNING * INTO v_user_track;
  END IF;

  RETURN v_user_track;
END;
$$;

REVOKE ALL ON FUNCTION public.register_track FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_track TO authenticated;
