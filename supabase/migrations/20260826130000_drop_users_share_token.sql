-- Migration unit: drop_users_share_token
-- Transaction mode: transactional
-- Boundary reason: default
--
-- DESTRUCTIVE follow-up to 20260826120000_security_hardening_phase3.sql.
--
-- Only run AFTER the updated frontend and stream-track function are deployed:
--   * LibraryShareSettings now reads user_share_tokens (legacy fallback first).
--   * SharedLibraryView resolves links via shared_library_owner(p_token) RPC.
--   * stream-track authorizes via user_share_tokens (legacy fallback first).
--
-- Once those are live, no client reads users.share_token and the anon-readable
-- copy of every owner's share token can finally be removed.

-- Catch accounts created between phase3 and this migration.
INSERT INTO public.user_share_tokens (user_id, share_token)
SELECT id, share_token
FROM public.users
WHERE share_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.users DROP COLUMN IF EXISTS share_token;
