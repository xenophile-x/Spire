-- Indexes for fast audio loading and querying

-- Fast lookup of user's personal audio files
CREATE INDEX IF NOT EXISTS idx_user_tracks_user_id ON public.user_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tracks_track_id ON public.user_tracks(track_id);


-- Playlist track ordering
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_order ON public.playlist_tracks(playlist_id, position);


-- Analytics & listening history queries
CREATE INDEX IF NOT EXISTS idx_listening_history_user_date ON public.listening_history(user_id, created_at DESC);


-- Text search index for title/artist searches
CREATE INDEX IF NOT EXISTS idx_tracks_canonical_title ON public.tracks USING gin(to_tsvector('english', canonical_title));