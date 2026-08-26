-- Migration: Add discord_id to users table for bot integration
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discord_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_discord_id ON public.users (discord_id);

-- Allow service_role to read discord_id for bot lookups
GRANT SELECT ON public.users TO service_role;