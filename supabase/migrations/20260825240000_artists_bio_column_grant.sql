-- Migration unit: artists_bio_column_grant
-- Transaction mode: transactional
-- Boundary reason: default
--
-- 20260825200000_security_hardening_phase2.sql scoped artist updates to
-- photo_url only (anti-vandalism). The artist profile sync now also fills
-- artists.bio from Wikipedia, so the column grant must include bio.
-- Still column-scoped: name/id/created_at stay untouchable by clients.

GRANT UPDATE (photo_url, bio) ON TABLE public.artists TO authenticated;
