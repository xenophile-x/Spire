-- Migration unit: library_sharing
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_library_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid() UNIQUE;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow public to read user profile info if their library is set to public
CREATE POLICY "Public read user profiles with shared libraries"
ON public.users FOR SELECT
USING (is_library_public = true OR auth.uid() = id);

-- Allow public to read user_tracks if the owner's library is public
CREATE POLICY "Public read user_tracks from shared libraries"
ON public.user_tracks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = user_tracks.user_id
    AND users.is_library_public = true
  )
  OR auth.uid() = user_id
);

-- Allow public to read tracks metadata & lyrics associated with shared tracks
CREATE POLICY "Public read tracks data" ON public.tracks FOR SELECT USING (true);
CREATE POLICY "Public read track metadata" ON public.track_metadata FOR SELECT USING (true);
CREATE POLICY "Public read track lyrics" ON public.track_lyrics FOR SELECT USING (true);