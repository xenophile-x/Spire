import { supabase } from "@/lib/supabaseClient";
import { fetchArtistImage, fetchSongCover } from "@/utils/fetchMetadata";

const DEFAULT_COVER = "https://cdn.saleminteractivemedia.com/shared/images/default-cover-art.png";
const DEFAULT_ARTIST = "/default-artist-avatar.jpg";

export async function resolveTrackCover(trackId, title, artist, existingCoverUrl) {
  if (existingCoverUrl && existingCoverUrl !== DEFAULT_COVER) {
    return existingCoverUrl;
  }

  const newCover = await fetchSongCover(title, artist);

  if (newCover && trackId && newCover !== DEFAULT_COVER) {
    supabase
      .from("tracks")
      .update({ cover_url: newCover })
      .eq("id", trackId)
      .then(({ error }) => {
        if (error) console.error("Failed caching track cover to Supabase:", error);
      });
  }

  return newCover || DEFAULT_COVER;
}

export async function resolveArtistImage(artistId, artistName, existingImageUrl) {
  if (existingImageUrl && existingImageUrl !== DEFAULT_ARTIST) {
    return existingImageUrl;
  }

  const newImage = await fetchArtistImage(artistName);

  if (newImage && artistId && newImage !== DEFAULT_ARTIST) {
    supabase
      .from("artists")
      .update({ image_url: newImage })
      .eq("id", artistId)
      .then(({ error }) => {
        if (error) console.error("Failed caching artist image to Supabase:", error);
      });
  }

  return newImage || DEFAULT_ARTIST;
}