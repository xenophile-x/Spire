-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE FUNCTION public.create_default_liked_playlist()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  INSERT INTO public.playlists (user_id, title, description, is_system)
  VALUES (NEW.id, 'Liked Songs', 'Your favorite tracks', true);
  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public.create_default_liked_playlist() TO anon;

GRANT ALL ON FUNCTION public.create_default_liked_playlist() TO authenticated;

GRANT ALL ON FUNCTION public.create_default_liked_playlist() TO service_role;

CREATE FUNCTION public.handle_new_google_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, google_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'sub'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW();
  RETURN NEW;
END;
$function$;

GRANT ALL ON FUNCTION public.handle_new_google_user() TO anon;

GRANT ALL ON FUNCTION public.handle_new_google_user() TO authenticated;

GRANT ALL ON FUNCTION public.handle_new_google_user() TO service_role;

CREATE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;

GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

CREATE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;

GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;

GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;

CREATE TABLE public.google_oauth_tokens (
  user_id       uuid                     NOT NULL,
  access_token  text                     NOT NULL,
  refresh_token text,
  scope         text,
  token_type    text                     DEFAULT 'Bearer'::text,
  expires_at    timestamp with time zone NOT NULL,
  created_at    timestamp with time zone DEFAULT now() NOT NULL,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.google_oauth_tokens
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.google_oauth_tokens
  ADD CONSTRAINT google_oauth_tokens_pkey PRIMARY KEY (user_id);

GRANT ALL ON public.google_oauth_tokens TO anon;

GRANT ALL ON public.google_oauth_tokens TO authenticated;

GRANT ALL ON public.google_oauth_tokens TO service_role;

CREATE TRIGGER trg_google_oauth_tokens_updated_at
  BEFORE UPDATE ON public.google_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Users can insert their own oauth token" ON public.google_oauth_tokens
  FOR INSERT
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their own access token" ON public.google_oauth_tokens
  FOR UPDATE
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can view their own oauth token" ON public.google_oauth_tokens
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE TABLE public.liked_songs (
  user_id  uuid                     NOT NULL,
  track_id uuid                     NOT NULL,
  liked_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.liked_songs
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.liked_songs
  ADD CONSTRAINT liked_songs_pkey PRIMARY KEY (user_id, track_id);

GRANT ALL ON public.liked_songs TO anon;

GRANT ALL ON public.liked_songs TO authenticated;

GRANT ALL ON public.liked_songs TO service_role;

CREATE POLICY "Users manage their own liked songs" ON public.liked_songs
  USING ((auth.uid() = user_id));

CREATE TABLE public.listening_history (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id    uuid                     NOT NULL,
  track_id   uuid                     NOT NULL,
  genre      text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.listening_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.listening_history
  ADD CONSTRAINT listening_history_pkey PRIMARY KEY (id);

GRANT ALL ON public.listening_history TO anon;

GRANT ALL ON public.listening_history TO authenticated;

GRANT ALL ON public.listening_history TO service_role;

CREATE POLICY "Users manage their own history" ON public.listening_history
  USING ((auth.uid() = user_id));

CREATE TABLE public.playlist_tracks (
  playlist_id uuid                     NOT NULL,
  track_id    uuid                     NOT NULL,
  "position"  integer                  DEFAULT 1 NOT NULL,
  added_at    timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.playlist_tracks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.playlist_tracks
  ADD CONSTRAINT playlist_tracks_pkey PRIMARY KEY (playlist_id, track_id);

GRANT ALL ON public.playlist_tracks TO anon;

GRANT ALL ON public.playlist_tracks TO authenticated;

GRANT ALL ON public.playlist_tracks TO service_role;

CREATE TABLE public.playlists (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id     uuid                     NOT NULL,
  title       text                     NOT NULL,
  description text,
  is_public   boolean                  DEFAULT false,
  created_at  timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE POLICY "Anyone views public playlist tracks" ON public.playlist_tracks
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.playlists
  WHERE ((playlists.id = playlist_tracks.playlist_id) AND (playlists.is_public = true)))));

CREATE POLICY "Users manage tracks in their playlists" ON public.playlist_tracks
  USING ((EXISTS ( SELECT 1
   FROM public.playlists
  WHERE ((playlists.id = playlist_tracks.playlist_id) AND (playlists.user_id = auth.uid())))));

ALTER TABLE public.playlists
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.playlists
  ADD CONSTRAINT playlists_pkey PRIMARY KEY (id);

ALTER TABLE public.playlist_tracks
  ADD CONSTRAINT playlist_tracks_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;

GRANT ALL ON public.playlists TO anon;

GRANT ALL ON public.playlists TO authenticated;

GRANT ALL ON public.playlists TO service_role;

CREATE POLICY "Anyone can view public playlists" ON public.playlists
  FOR SELECT
  USING ((is_public = true));

CREATE POLICY "Users manage their own playlists" ON public.playlists
  USING ((auth.uid() = user_id));

CREATE TABLE public.recommendations (
  id                   uuid                     DEFAULT gen_random_uuid() NOT NULL,
  source_track_id      uuid                     NOT NULL,
  recommended_track_id uuid                     NOT NULL,
  score                numeric                  DEFAULT 0.0000,
  created_at           timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.recommendations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_pkey PRIMARY KEY (id);

GRANT ALL ON public.recommendations TO anon;

GRANT ALL ON public.recommendations TO authenticated;

GRANT ALL ON public.recommendations TO service_role;

CREATE TABLE public.track_lyrics (
  track_id      uuid                     NOT NULL,
  synced_lyrics text,
  plain_lyrics  text,
  is_synced     boolean                  DEFAULT false,
  updated_at    timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.track_lyrics
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.track_lyrics
  ADD CONSTRAINT track_lyrics_pkey PRIMARY KEY (track_id);

ALTER TABLE public.track_lyrics
  ADD CONSTRAINT track_lyrics_track_id_unique UNIQUE (track_id);

GRANT ALL ON public.track_lyrics TO anon;

GRANT ALL ON public.track_lyrics TO authenticated;

GRANT ALL ON public.track_lyrics TO service_role;

CREATE POLICY "Anyone can view lyrics" ON public.track_lyrics
  FOR SELECT
  USING (true);

CREATE POLICY "Auth users insert lyrics" ON public.track_lyrics
  FOR INSERT
  WITH CHECK ((auth.role() = 'authenticated'::text));

CREATE TABLE public.track_metadata (
  track_id      uuid                     NOT NULL,
  album_name    text,
  artwork_url   text,
  release_year  integer,
  primary_genre text,
  isrc_code     text,
  created_at    timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.track_metadata
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.track_metadata
  ADD CONSTRAINT track_metadata_pkey PRIMARY KEY (track_id);

ALTER TABLE public.track_metadata
  ADD CONSTRAINT track_metadata_track_id_unique UNIQUE (track_id);

GRANT ALL ON public.track_metadata TO anon;

GRANT ALL ON public.track_metadata TO authenticated;

GRANT ALL ON public.track_metadata TO service_role;

CREATE POLICY "Anyone can view metadata" ON public.track_metadata
  FOR SELECT
  USING (true);

CREATE POLICY "Auth users insert metadata" ON public.track_metadata
  FOR INSERT
  WITH CHECK ((auth.role() = 'authenticated'::text));

CREATE TABLE public.tracks (
  id               uuid                     DEFAULT gen_random_uuid() NOT NULL,
  canonical_title  text                     NOT NULL,
  canonical_artist text                     NOT NULL,
  duration_seconds numeric,
  created_at       timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tracks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tracks
  ADD CONSTRAINT tracks_pkey PRIMARY KEY (id);

ALTER TABLE public.liked_songs
  ADD CONSTRAINT liked_songs_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;

ALTER TABLE public.listening_history
  ADD CONSTRAINT listening_history_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;

ALTER TABLE public.playlist_tracks
  ADD CONSTRAINT playlist_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;

ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_recommended_track_id_fkey FOREIGN KEY (recommended_track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;

ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_source_track_id_fkey FOREIGN KEY (source_track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;

ALTER TABLE public.track_lyrics
  ADD CONSTRAINT track_lyrics_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;

ALTER TABLE public.track_metadata
  ADD CONSTRAINT track_metadata_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;

GRANT ALL ON public.tracks TO anon;

GRANT ALL ON public.tracks TO authenticated;

GRANT ALL ON public.tracks TO service_role;

CREATE POLICY "Anyone can view tracks" ON public.tracks
  FOR SELECT
  USING (true);

CREATE POLICY "Auth users insert tracks" ON public.tracks
  FOR INSERT
  WITH CHECK ((auth.role() = 'authenticated'::text));

CREATE TABLE public.user_sessions (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id      uuid                     NOT NULL,
  ip_address   text,
  user_agent   text,
  device_label text,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  is_active    boolean                  DEFAULT true NOT NULL
);

ALTER TABLE public.user_sessions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_sessions
  ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);

GRANT ALL ON public.user_sessions TO anon;

GRANT ALL ON public.user_sessions TO authenticated;

GRANT ALL ON public.user_sessions TO service_role;

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions (user_id);

CREATE POLICY "Users can delete their own sessions" ON public.user_sessions
  FOR DELETE
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can insert their own sessions" ON public.user_sessions
  FOR INSERT
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their own sessions" ON public.user_sessions
  FOR UPDATE
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can view their own sessions" ON public.user_sessions
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE TABLE public.user_tracks (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id           uuid                     NOT NULL,
  track_id          uuid                     NOT NULL,
  drive_file_id     text                     NOT NULL,
  uploaded_filename text                     NOT NULL,
  created_at        timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_tracks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_tracks
  ADD CONSTRAINT user_tracks_pkey PRIMARY KEY (id);

ALTER TABLE public.user_tracks
  ADD CONSTRAINT user_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;

GRANT ALL ON public.user_tracks TO anon;

GRANT ALL ON public.user_tracks TO authenticated;

GRANT ALL ON public.user_tracks TO service_role;

CREATE POLICY "Users manage their own user_tracks" ON public.user_tracks
  USING ((auth.uid() = user_id));

CREATE TABLE public.users (
  id         uuid                     NOT NULL,
  email      text                     NOT NULL,
  full_name  text,
  avatar_url text,
  google_id  text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.users
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users
  ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE public.users
  ADD CONSTRAINT users_google_id_key UNIQUE (google_id);

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.users
  ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE public.google_oauth_tokens
  ADD CONSTRAINT google_oauth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.liked_songs
  ADD CONSTRAINT liked_songs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.listening_history
  ADD CONSTRAINT listening_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.playlists
  ADD CONSTRAINT playlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_sessions
  ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_tracks
  ADD CONSTRAINT user_tracks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

GRANT ALL ON public.users TO anon;

GRANT ALL ON public.users TO authenticated;

GRANT ALL ON public.users TO service_role;

CREATE POLICY "Users can manage their own profile" ON public.users
  USING ((auth.uid() = id));
