-- Fix infinite recursion in library_shares policies
-- Run this AFTER the main migration (which partially succeeded)

-- 1. Drop the problematic policies
DROP POLICY IF EXISTS "Library shares readable by grantee or owner" ON public.library_shares;
DROP POLICY IF EXISTS "Users can manage their outgoing invites" ON public.library_shares;
DROP POLICY IF EXISTS "Users can accept incoming invites" ON public.library_shares;
DROP POLICY IF EXISTS "Invitees delete incoming invites" ON public.library_shares;

-- 2. Recreate clean, non-recursive policies

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

-- 3. Fix users policy - the recursion was from users policy referencing library_shares
-- which then referenced users. Simplify to avoid cross-reference.
DROP POLICY IF EXISTS "Public read user profiles with shared libraries" ON public.users;

CREATE POLICY "Public read user profiles with shared libraries"
ON public.users FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    is_library_public = true
    OR auth.uid() = id
  )
);

-- Note: Library share access to profiles is handled by the share page
-- calling shared_library_owner RPC directly, not via users table RLS.

-- 4. Re-grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_shares TO authenticated;
REVOKE ALL ON public.library_shares FROM anon;