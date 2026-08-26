-- Migration unit: backfill_share_tokens
-- Transaction mode: transactional
-- Boundary reason: default
--
-- 20260824000000_library_sharing.sql added users.share_token with only a
-- DEFAULT, so accounts created before that date have NULL. The share-link
-- page and stream-track both match on this column, so those owners' shared
-- libraries silently return nothing. Populate any missing tokens.
--
-- (UNIQUE already exists; UUID collisions are practically impossible.)

UPDATE public.users
SET share_token = gen_random_uuid()
WHERE share_token IS NULL;

ALTER TABLE public.users
  ALTER COLUMN share_token SET DEFAULT gen_random_uuid(),
  ALTER COLUMN share_token SET NOT NULL;
