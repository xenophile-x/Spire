-- ============================================================
-- FAVORITE ARTISTS — per-user pinning of artists
-- Junction table so favorites are private per account.
-- Run with: supabase db push   (or paste into the SQL editor)
-- ============================================================

create table if not exists public.favorite_artists (
  user_id    uuid not null references auth.users(id) on delete cascade,
  artist_id  uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create index if not exists idx_favorite_artists_artist_id
  on public.favorite_artists(artist_id);

alter table public.favorite_artists enable row level security;

grant select, insert, delete on public.favorite_artists
  to authenticated, service_role;

create policy "Users manage their own favorite artists"
  on public.favorite_artists
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
