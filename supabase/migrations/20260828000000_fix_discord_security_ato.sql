-- Migration: Fix Discord ATO vectors + RLS hardening + OAuth trigger fix
-- Optimized for security + performance (indexed, partial indexes, search_path)

-- ============================================================
-- 1. Harden users table: clients must NOT be able to set discord_id directly
-- ============================================================
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.users;

CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile (no discord_id hijack)"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      discord_id IS NOT DISTINCT FROM (
        SELECT u.discord_id FROM public.users u WHERE u.id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_client_discord_id_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.discord_id IS NOT DISTINCT FROM OLD.discord_id THEN
    RETURN NEW;
  END IF;
  IF coalesce((auth.jwt()->>'role'), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF current_user IN ('postgres','supabase_admin') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Direct update of discord_id is not allowed. Use /link code or Discord OAuth.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_client_discord_id_update ON public.users;
CREATE TRIGGER trg_prevent_client_discord_id_update
  BEFORE UPDATE OF discord_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_discord_id_update();

-- ============================================================
-- 2. linking_codes hardening + performance indexes
-- ============================================================
DROP POLICY IF EXISTS "Users can read own linking codes" ON public.linking_codes;
DROP POLICY IF EXISTS "Users can delete own linking codes" ON public.linking_codes;
REVOKE ALL ON public.linking_codes FROM anon, authenticated;

-- Fast lookup for bot duplicate check & redeem
CREATE UNIQUE INDEX IF NOT EXISTS idx_linking_codes_discord_id_active
  ON public.linking_codes (discord_id) WHERE expires_at > now();
CREATE INDEX IF NOT EXISTS idx_linking_codes_code_expires
  ON public.linking_codes (code, expires_at);

-- ============================================================
-- 3. OAuth trigger: correct identities parsing + 23505 handling + updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_discord_oauth_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  identity_record jsonb;
  discord_sub text;
BEGIN
  IF NEW.raw_app_meta_data IS NOT NULL AND NEW.raw_app_meta_data ? 'identities' THEN
    FOR identity_record IN SELECT * FROM jsonb_array_elements(NEW.raw_app_meta_data->'identities')
    LOOP
      IF identity_record->>'provider' = 'discord' THEN
        discord_sub := identity_record->>'id';
        IF discord_sub IS NULL THEN discord_sub := identity_record->'identity_data'->>'provider_id'; END IF;
        IF discord_sub IS NULL THEN discord_sub := identity_record->'identity_data'->>'sub'; END IF;
        IF discord_sub IS NULL THEN discord_sub := identity_record->>'provider_id'; END IF;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF discord_sub IS NULL AND NEW.raw_user_meta_data->>'provider' = 'discord' THEN
    discord_sub := NEW.raw_user_meta_data->>'provider_id';
    IF discord_sub IS NULL THEN discord_sub := NEW.raw_user_meta_data->>'sub'; END IF;
  END IF;

  IF discord_sub IS NOT NULL THEN
    BEGIN
      UPDATE public.users
      SET discord_id = discord_sub, updated_at = NOW()
      WHERE id = NEW.id AND (discord_id IS NULL OR discord_id IS DISTINCT FROM discord_sub);
    EXCEPTION WHEN unique_violation THEN
      RAISE WARNING 'Discord ID % is already assigned to another user profile.', discord_sub;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_discord_link ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_discord_link ON auth.users;
CREATE TRIGGER on_auth_user_discord_link
  AFTER INSERT OR UPDATE OF raw_user_meta_data, raw_app_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_discord_oauth_link();
