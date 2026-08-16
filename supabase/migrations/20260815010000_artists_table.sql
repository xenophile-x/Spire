-- ============================================================
-- ARTISTS — proper artist metadata (photo, bio)
-- iTunes-style artist circles need a real artist entity with a photo.
-- Run with: supabase db push   (or paste into the SQL editor)
-- ============================================================

create table if not exists public.artists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  photo_url  text,
  bio        text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_artists_updated_at on public.artists;
create trigger trg_artists_updated_at
  before update on public.artists
  for each row execute function public.set_updated_at();

-- Link each track to its artist row
alter table public.tracks
  add column if not exists artist_id uuid references public.artists(id) on delete set null;

create index if not exists idx_tracks_artist_id on public.tracks(artist_id);

-- Backfill: create one artist row per distinct canonical_artist and link it.
-- Skip empty/unknown names.
with new_artists as (
  insert into public.artists (name)
  select distinct canonical_artist
  from public.tracks
  where canonical_artist is not null
    and trim(canonical_artist) <> ''
    and lower(canonical_artist) not in ('unknown', 'unknown artist')
  on conflict (name) do nothing
  returning name
)
update public.tracks t
set artist_id = a.id
from public.artists a
where a.name = t.canonical_artist
  and t.artist_id is null;

-- API access: everyone can read artists; authenticated users can add/update.
alter table public.artists enable row level security;

grant select on public.artists to anon, authenticated, service_role;
grant insert, update on public.artists to authenticated, service_role;

create policy "Artists are readable by everyone"
  on public.artists for select
  using (true);

create policy "Authenticated users can add artists"
  on public.artists for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update artists"
  on public.artists for update
  using (auth.role() = 'authenticated');
