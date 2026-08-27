-- Migration: Discord linking — linking_codes table + OAuth trigger
-- Method 2: One-time linking codes (bot /link command)
-- Method 1: Auto-save discord_id from Discord OAuth provider

-- ============================================================
-- METHOD 2: linking_codes table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.linking_codes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code       text NOT NULL,
  discord_id text NOT NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_linking_codes_code ON public.linking_codes (code);
CREATE INDEX IF NOT EXISTS idx_linking_codes_expires ON public.linking_codes (expires_at);

-- Allow anon (logged-in web app users) to redeem codes
ALTER TABLE public.linking_codes ENABLE ROW LEVEL SECURITY;

-- Users can read codes matching their own user_id (for redemption)
CREATE POLICY "Users can read own linking codes"
  ON public.linking_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert codes (bot writes via service_role key)
-- No RLS policy needed — service_role bypasses RLS

-- Users can delete their own codes (cleanup after redemption)
CREATE POLICY "Users can delete own linking codes"
  ON public.linking_codes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Allow service_role full access for bot operations
GRANT ALL ON public.linking_codes TO service_role;

-- ============================================================
-- METHOD 1: Auto-save discord_id from Discord OAuth
-- ============================================================
-- Trigger function: when a user links a Discord identity via Supabase OAuth,
-- extract provider_id from raw_user_meta_data and save to users.discord_id.

CREATE OR REPLACE FUNCTION public.handle_discord_oauth_link()
RETURNS trigger AS $$
DECLARE
  v_discord_id text;
BEGIN
  -- Check if Discord was just linked/updated
  IF NEW.raw_user_meta_data->>'provider' = 'discord' THEN
    v_discord_id := NEW.raw_user_meta_data->>'provider_id';
  ELSIF NEW.raw_app_meta_data->>'provider' = 'discord' THEN
    v_discord_id := NEW.raw_user_meta_data->>'provider_id';
  END IF;

  -- Also check the identities array (Supabase stores linked providers here)
  IF v_discord_id IS NULL AND NEW.identities IS NOT NULL THEN
    SELECT id INTO v_discord_id
    FROM jsonb_array_elements(NEW.identities) AS ident
    WHERE ident->>'provider' = 'discord'
    LIMIT 1;
  END IF;

  IF v_discord_id IS NOT NULL THEN
    UPDATE public.users
    SET discord_id = v_discord_id
    WHERE id = NEW.id AND (discord_id IS NULL OR discord_id != v_discord_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if it exists, then create new one
DROP TRIGGER IF EXISTS on_auth_user_discord_link ON auth.users;

CREATE TRIGGER on_auth_user_discord_link
  AFTER UPDATE OF raw_user_meta_data, identities ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_discord_oauth_link();
