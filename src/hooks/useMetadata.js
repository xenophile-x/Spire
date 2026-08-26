import { useEffect, useRef, useState } from "react";
import { fetchArtistImage, fetchSongCover } from "@/utils/fetchMetadata";

export function useArtistPhoto(artistName) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [loading, setLoading] = useState(Boolean(artistName));
  const latestRef = useRef(0);

  useEffect(() => {
    const token = ++latestRef.current;
    if (!artistName || !artistName.trim()) {
      setPhotoUrl("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPhotoUrl("");

    fetchArtistImage(artistName).then((url) => {
      if (latestRef.current !== token) return;
      setPhotoUrl(url || "");
      setLoading(false);
    });
  }, [artistName]);

  return { photoUrl, loading };
}

export function useCoverArt(trackTitle, artistName = "") {
  const [coverUrl, setCoverUrl] = useState("");
  const [loading, setLoading] = useState(Boolean(trackTitle));
  const latestRef = useRef(0);

  useEffect(() => {
    const token = ++latestRef.current;
    if (!trackTitle || !trackTitle.trim()) {
      setCoverUrl("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setCoverUrl("");

    fetchSongCover(trackTitle, artistName).then((url) => {
      if (latestRef.current !== token) return;
      setCoverUrl(url || "");
      setLoading(false);
    });
  }, [trackTitle, artistName]);

  return { coverUrl, loading };
}
