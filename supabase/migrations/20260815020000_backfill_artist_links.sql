-- Re-link tracks to their artist rows (idempotent)
update public.tracks t
set artist_id = a.id
from public.artists a
where a.name = t.canonical_artist
  and t.artist_id is null;
