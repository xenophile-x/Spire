-- Fix infinite recursion in library_shares policies (force clean slate)
-- Drops ALL policies first, then recreates clean ones

-- ============================================================
-- 1. DROP ALL existing policies on library_shares (no errors if missing)
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'library_shares'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.library_shares;', r.policyname);
  END LOOP;
END $$;

-- ============================================================
-- 2. DROP ALL existing policies on users (only the problematic one)
-- ============================================================
DROP POLICY IF EXISTS "Public read user profiles with shared libraries" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;

-- ============================================================
-- 3. RECREATE clean library_shares policies
-- ============================================================

-- Owner: full control over outgoing invites
CREATE POLICY "Owners manage outgoing invites"
ON public.library_shares FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Invitee: view invites addressed to their email
CREATE POLICY "Invitees view incoming invites"
ON public.library_shares FOR SELECT
USING (
  lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Invitee: accept pending invites (pending -> accepted, set grantee_id)
CREATE POLICY "Invitees accept incoming invites"
ON public.library_shares FOR UPDATE
USING (
  status = 'pending'
  AND lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  AND (expires_at IS NULL OR expires_at > now())
)
WITH CHECK (
  status = 'accepted'
  AND grantee_id = auth.uid()
  AND lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Invitee: delete invites addressed to them
CREATE POLICY "Invitees delete incoming invites"
ON public.library_shares FOR DELETE
USING (
  lower(grantee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- ============================================================
-- 4. RECREATE clean users policy (no cross-reference to library_shares)
-- ============================================================
CREATE POLICY "Public read user profiles with shared libraries"
ON public.users FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    is_library_public = true
    OR auth.uid() = id
  )
);

-- ============================================================
-- 5. Ensure grants
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_shares TO authenticated;
REVOKE ALL ON public.library_shares FROM anon;

-- ============================================================
-- 6. Verify linking_codes has correct setup (service_role only)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'linking_codes' AND n.nspname = 'public' AND c.relrowsecurity
  ) THEN
    ALTER TABLE public.linking_codes ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop any policies on linking_codes (should be none - service_role only)
DROP POLICY IF EXISTS "Users can read own linking codes" ON public.linking_codes;
DROP POLICY IF EXISTS "Users can delete own linking codes" ON public.linking_codes;

REVOKE ALL ON public.linking_codes FROM anon, authenticated;
GRANT ALL ON public.linking_codes TO service_role;