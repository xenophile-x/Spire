-- Migration unit: lock_oauth_tokens_table
-- Transaction mode: transactional
-- Boundary reason: default
--
-- google_oauth_tokens is now written exclusively by the store-google-token
-- edge function via the service role (bypasses RLS/grants). The browser has
-- no business reading OR writing this table:
--   - reading leaked refresh tokens to any XSS
--   - the client-side upsert started 403-ing once RLS was properly enforced,
--     which starved stream-track/delete-track of tokens (playback went silent)
--
-- Drops every client-facing path. Service role keeps its explicit grants.

DROP POLICY IF EXISTS "Users can insert their own oauth token" ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "Users can update their own access token" ON public.google_oauth_tokens;

REVOKE ALL ON public.google_oauth_tokens FROM anon, authenticated;
