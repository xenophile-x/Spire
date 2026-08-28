import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

async function fetchSharedTrackAudio(userTrackId, shareToken) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Streaming is not configured.");
  const response = await fetch(
    `${supabaseUrl}/functions/v1/stream-track?trackId=${encodeURIComponent(userTrackId)}&shareToken=${encodeURIComponent(shareToken)}`
  );
  if (!response.ok) throw new Error(`Stream error: ${response.status}`);
  const rawBlob = await response.blob();
  const mimeType =
    rawBlob.type && rawBlob.type !== "application/octet-stream"
      ? rawBlob.type
      : "audio/mpeg";
  const audioBlob =
    rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });
  return URL.createObjectURL(audioBlob);
}

function mapSharedTrack(row) {
  return {
    id: row.track_id || row.id,
    userTrackId: row.id,
    title: row.canonical_title || row.uploaded_filename || "Untitled Track",
    artist: row.canonical_artist || "Unknown Artist",
    cover: row.artwork_url || null,
    synced_lyrics: row.synced_lyrics || "",
    duration: row.duration_seconds || 0,
  };
}

export default function SharedLibraryView() {
  const { shareToken } = useParams();
  const [owner, setOwner] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const loadTokenRef = useRef(0);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playError, setPlayError] = useState(null);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedLibrary() {
      if (!shareToken) {
        if (!cancelled) setError("This share link is invalid.");
        return;
      }

      let userData = null;

      const { data: rpcData, error: rpcError } = await supabase
        .rpc("shared_library_owner", { p_token: shareToken })
        .maybeSingle();

      if (rpcError || !rpcData) {
        if (!cancelled) setError("This library is private or does not exist.");
        return;
      }
      userData = rpcData;
      setOwner(userData);

      const { data: trackData, error: trackError } = await supabase
        .rpc("get_shared_library_tracks", { p_token: shareToken });

      if (cancelled) return;

      if (trackError) {
        setError("Could not load this shared library.");
        return;
      }

      setTracks((trackData || []).map(mapSharedTrack).filter((t) => t.id));
    }

    loadSharedLibrary().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handlePlayTrack = async (track) => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(() => {});
      }
      return;
    }

    const myToken = ++loadTokenRef.current;
    audio.pause();
    setCurrentTrack(track);
    setPlayError(null);
    setIsPlaying(false);
    setIsLoadingTrack(true);

    if (!track.userTrackId) {
      setIsLoadingTrack(false);
      setPlayError("No playable source for this track.");
      return;
    }

    try {
      const url = await fetchSharedTrackAudio(track.userTrackId, shareToken);
      if (loadTokenRef.current !== myToken) {
        URL.revokeObjectURL(url);
        return;
      }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
      audio.src = url;
      audio.load();
      await audio.play();
    } catch (err) {
      console.error("[SharedLibrary] Playback failed:", err);
      if (loadTokenRef.current === myToken) {
        if (err && err.name === "NotAllowedError") {
          setPlayError("Tap the play button again to start playback.");
        } else {
          setPlayError("Could not play this track.");
        }
      }
    } finally {
      if (loadTokenRef.current === myToken) setIsLoadingTrack(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-8 text-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold mb-1">
          {loading ? "Shared Library" : `${owner?.full_name || "Shared"}'s Shared Library`}
        </h1>
        <p className="text-sm text-white/60 mb-6">
          {loading ? "Loading shared library…" : `${tracks.length} tracks shared`}
        </p>

        {playError && <p className="mb-4 text-xs text-amber-400">{playError}</p>}

        <div className="flex flex-col gap-2">
          {loading &&
            [...Array(4)].map((_, i) => (
              <div key={`skeleton-${i}`} className="p-3 rounded-lg bg-white/5 animate-pulse flex items-center justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="h-3 w-40 rounded bg-white/10" />
                  <div className="h-2.5 w-24 rounded bg-white/10" />
                </div>
                <div className="h-5 w-5 rounded-full bg-white/10" />
              </div>
            ))}

          {!loading && tracks.length === 0 && (
            <p className="text-sm text-white/50">No tracks have been shared yet.</p>
          )}

          {!loading &&
            tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => handlePlayTrack(track)}
                className={`p-3 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                  currentTrack?.id === track.id
                    ? "bg-white/15"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{track.title}</p>
                  <p className="text-xs text-white/60 truncate">{track.artist}</p>
                </div>
                <span className="material-symbols-rounded ml-3 shrink-0 text-white/70">
                  {currentTrack?.id === track.id && isLoadingTrack
                    ? "progress_activity"
                    : currentTrack?.id === track.id && isPlaying
                      ? "pause_circle"
                      : "play_circle"}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
