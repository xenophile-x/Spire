-- Migration unit: drop_artists_itunes_artist_id
-- Transaction mode: transactional
-- Boundary reason: default
--
-- Consolidation: 20260826140000 added artists.itunes_artist_id while
-- 20260826150000 independently shipped artists.provider_id (text, generic —
-- Apple id or MBID). Two identity columns for the same concept invites
-- drift; provider_id wins. Client code writes Apple artistId strings there.
--
-- Also grants UPDATE on provider_id: security_hardening_phase2 scoped artist
-- updates to an explicit column list, so without this the upload-time stamp
-- would be rejected despite RLS SELECT/INSERT working.

ALTER TABLE public.artists
  DROP COLUMN IF EXISTS itunes_artist_id;

GRANT UPDATE (photo_url, bio, provider_id) ON TABLE public.artists TO authenticated;
