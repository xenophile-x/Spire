-- ============================================================
-- 1-MONTH OAUTH TOKEN SESSION TTL
-- Policy change: Drive access is renewed silently (no re-login)
-- for 1 month instead of re-prompting every ~60 minutes.
--
-- Google's access_token still expires after ~1 hour and is refreshed
-- server-side via refresh_token (see refresh-google-token edge
-- function). To make that renewal invisible for a month, each user's
-- token row now carries a session_expires_at window of 1 month.
-- Once it passes, the app requests full re-authentication.
-- ============================================================

alter table public.google_oauth_tokens
  add column if not exists session_expires_at timestamptz not null default (now() + interval '1 month');

comment on column public.google_oauth_tokens.session_expires_at is
  'When the 1-month "no re-login" window ends. Within it the app keeps Drive access alive by silently refreshing the short-lived access_token via refresh_token; after it passes the user must re-consent.';

comment on column public.google_oauth_tokens.expires_at is
  'Real expiry of the short-lived Google access_token (~1 hour, set at login/refresh). Not used for the 1-month policy; that is session_expires_at.';

comment on column public.google_oauth_tokens.refresh_token is
  'Long-lived token (issued on first consent with access_type=offline). Required to renew access_token without re-auth for the 1-month window. Never sent to the browser; only the Edge Function (service_role) reads/writes it.';
