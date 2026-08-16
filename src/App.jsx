import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

import FloatingBar from "@/components/FloatingBar";
import MobileNav from "@/components/MobileNav";
import GlassSearchBar from "@/components/GlassSearchBar";
import MusicBar from "@/components/MusicBar";
import AudioPlayer from "@/components/AudioPlayer";
import UploadModal from "@/components/UploadModal";
import TemperedGlassCard from "@/components/ui/TemperedGlassCard";
import { GlassButton } from "@/components/ui/glasscn/glass-button";

import Opening from "@/components/Opening";
import Landing from "@/components/Landing";

import HomeView from "@/views/HomeView";
import ExploreView from "@/views/ExploreView";
import PlaylistsView from "@/views/PlaylistsView";
import ArtistView from "@/views/ArtistView";
import ExpandedLyricsView from "@/views/ExpandedLyricsView";
import SettingsView from "@/views/SettingsView";

import { processAudioUpload, fetchArtworkFromITunes } from "@/services/uploadPipeline";
import { fetchArtistPhoto } from "@/services/itunesService";

import { uploadBackgroundToDrive } from "@/services/driveService";
import { useListenTogether } from "@/hooks/useListenTogether";
import { useRadioBroadcast } from "@/hooks/useRadioBroadcast";
import { getRecommendedTracks } from "@/utils/recommend";
import { RADIO_STATIONS } from "@/constants/radioStations";
import { connectDiscord, setDiscordActivity, getDiscordUser } from "@/services/discordService";

import {
  getUserLibrary,
  getListeningHistoryWithGenres,
  recordListen,
  getLikedSongs,
  toggleLikedSong,
  getUserPlaylists,
  addTrackToPlaylist,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  removeTrackFromPlaylist,
  getDistinctArtistsWithIds,
  updateArtistPhoto,
} from "@/services/supabaseService";

const DEFAULT_BG_IMAGE =
  "https://images.unsplash.com/photo-1778789172863-a137613623e0?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const WALLPAPERS = [
  DEFAULT_BG_IMAGE,
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=2175&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1785679339355-36cd3f065f7b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHx0b3BpYy1mZWVkfDZ8NnNNVmpUTFNrZVF8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1785344468724-9f06e2534056?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHx0b3BpYy1mZWVkfDE4fDZzTVZqVExTa2VRfHxlbnwwfHx8fHw%3D",
  "https://images.unsplash.com/photo-1764140608148-80e010804af8?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHx0b3BpYy1mZWVkfDI1fDZzTVZqVExTa2VRfHxlbnwwfHx8fHw%3D",
  "https://images.unsplash.com/photo-1780715017688-a50312a5a249?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1777712081090-d335e662dce6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1782848796142-88a50598df91?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1777978206855-cbc9508b4f6d?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1785199879496-23409f65d45c?q=80&w=2076&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1781817388497-bd831004913b?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1784704564341-d09f0023d30f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1777849077481-a6a18ecc4552?q=80&w=1925&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://pixabay.com/videos/download/video-340838_medium.mp4",
];

const getBgUrlFromUser = (user, presetIdx, isPreset) => {
  const driveId = user?.user_metadata?.bg_drive_id;
  const usingPreset = isPreset ?? user?.user_metadata?.is_using_preset ?? !driveId;
  const idx = presetIdx ?? user?.user_metadata?.wallpaper_index ?? 0;

  if (usingPreset) {
    return WALLPAPERS[idx] || DEFAULT_BG_IMAGE;
  }
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w2560`;
  }
  return WALLPAPERS[idx] || DEFAULT_BG_IMAGE;
};

function AppContent() {
  const [likedTrackIds, setLikedTrackIds] = useState(new Set());
  const [playlists, setPlaylists] = useState([]);

  const { user, loading, googleAccessToken, signInWithGoogle, signOut, refreshGoogleToken } = useAuth();
  const navigate = useNavigate();

  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekTime, setSeekTime] = useState(null);
  const [volume, setVolume] = useState(70);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [radioStation, setRadioStation] = useState(RADIO_STATIONS[0]);
  const [activePlaylistId, setActivePlaylistId] = useState(null);

  const [playedTrackIds, setPlayedTrackIds] = useState([]);
  const [listeningHistory, setListeningHistory] = useState([]);

  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);
  const [startInLyrics, setStartInLyrics] = useState(false);

  const [recommendedPlaylist, setRecommendedPlaylist] = useState(() => {
    try {
      const raw = localStorage.getItem("spire:rec:songIds");
      if (!raw) return null;
      const ids = JSON.parse(raw);
      if (!Array.isArray(ids) || ids.length === 0) return null;
      return {
        id: "recommended",
        title: "Playlist made for you",
        isRecommended: true,
        songIds: ids,
      };
    } catch {
      return null;
    }
  });
  const [recommendedGeneratedAt, setRecommendedGeneratedAt] = useState(() =>
    Number(localStorage.getItem("spire:rec:generatedAt") || 0)
  );

  const [searchQuery, setSearchQuery] = useState("");

  // NEW: tracks whether the Google Drive token could not be silently refreshed,
  // meaning the user needs to reconnect via signInWithGoogle().
  const [needsReauth, setNeedsReauth] = useState(false);

  const loadUserPreferences = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [likes, userPlaylists] = await Promise.all([
        getLikedSongs(user.id),
        getUserPlaylists(user.id)
      ]);
      setLikedTrackIds(likes);

      const favoritePlaylist = {
        id: "1",
        title: "Favorite Songs",
        isFavorite: true,
        isStarIcon: true,
        image: "https://static.vecteezy.com/system/resources/previews/005/293/180/non_2x/a-star-with-rounded-corners-free-vector.jpg",
        songIds: Array.from(likes),
      };

      setPlaylists([favoritePlaylist, ...userPlaylists]);
    } catch (err) {
      console.error("Failed to load user preferences:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === "1" ? { ...pl, songIds: Array.from(likedTrackIds) } : pl
      )
    );
  }, [likedTrackIds]);

  const [userTracks, setUserTracks] = useState([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);

  const { tuneIn } = useRadioBroadcast(userTracks);

  const continueListening = useMemo(
    () =>
      playedTrackIds
        .map((id) => userTracks.find((t) => t.id === id))
        .filter(Boolean),
    [userTracks, playedTrackIds]
  );

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStep, setUploadStep] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const customBgDriveId = user?.user_metadata?.bg_drive_id;
  const initialIsPreset = user?.user_metadata?.is_using_preset ?? !customBgDriveId;
  const initialPresetIdx = user?.user_metadata?.wallpaper_index ?? 0;

  const [wallpaperIndex, setWallpaperIndex] = useState(initialPresetIdx);
  const [isUsingPreset, setIsUsingPreset] = useState(initialIsPreset);
  const [bgUploading, setBgUploading] = useState(false);
  const [localBgUrl, setLocalBgUrl] = useState(null);

  const targetBgUrl = useMemo(() => {
    if (localBgUrl) return localBgUrl;
    if (isUsingPreset) {
      return WALLPAPERS[wallpaperIndex] || DEFAULT_BG_IMAGE;
    }
    if (customBgDriveId) {
      return `https://drive.google.com/thumbnail?id=${customBgDriveId}&sz=w2560`;
    }
    return WALLPAPERS[wallpaperIndex] || DEFAULT_BG_IMAGE;
  }, [isUsingPreset, wallpaperIndex, localBgUrl, customBgDriveId]);

  const initialBgUrl = getBgUrlFromUser(user, initialPresetIdx, initialIsPreset);
  const [currentBg, setCurrentBg] = useState(initialBgUrl);
  const [prevBg, setPrevBg] = useState(initialBgUrl);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (user?.user_metadata) {
      const metaIsPreset = user.user_metadata.is_using_preset ?? !user.user_metadata.bg_drive_id;
      const metaIdx = user.user_metadata.wallpaper_index ?? 0;

      setIsUsingPreset(metaIsPreset);
      setWallpaperIndex(metaIdx);

      if (!localBgUrl) {
        const loadedUrl = getBgUrlFromUser(user, metaIdx, metaIsPreset);
        setCurrentBg(loadedUrl);
        setPrevBg(loadedUrl);
      }
    }
  }, [user, localBgUrl]);

  useEffect(() => {
    if (targetBgUrl === currentBg) return;

    let isMounted = true;
    const img = new Image();
    img.src = targetBgUrl;

    img.onload = () => {
      if (!isMounted) return;

      setPrevBg(currentBg);
      setCurrentBg(targetBgUrl);
      setIsFading(true);

      const timer = setTimeout(() => {
        if (isMounted) setIsFading(false);
      }, 50);

      return () => clearTimeout(timer);
    };

    if (targetBgUrl.startsWith("blob:")) {
      setPrevBg(currentBg);
      setCurrentBg(targetBgUrl);
    }

    return () => {
      isMounted = false;
    };
  }, [targetBgUrl, currentBg]);

  const handleThemeToggle = useCallback(async () => {
    const nextIndex = (wallpaperIndex + 1) % WALLPAPERS.length;
    setLocalBgUrl(null);
    setIsUsingPreset(true);
    setWallpaperIndex(nextIndex);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          is_using_preset: true,
          wallpaper_index: nextIndex,
        },
      });
      if (error) throw error;
      await supabase.auth.refreshSession();
    } catch (err) {
      console.error("Failed to persist preset wallpaper:", err);
    }
  }, [wallpaperIndex]);

  const handleBackgroundUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!googleAccessToken) {
        alert("Google Access Token missing. Please sign out and log back in.");
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setLocalBgUrl(previewUrl);
      setIsUsingPreset(false);

      try {
        setBgUploading(true);
        const driveFileId = await uploadBackgroundToDrive(
          file,
          googleAccessToken,
          customBgDriveId
        );

        if (!driveFileId) {
          throw new Error("Failed to receive Google Drive file ID.");
        }

        const { error } = await supabase.auth.updateUser({
          data: {
            bg_drive_id: driveFileId,
            is_using_preset: false,
          },
        });

        if (error) throw error;
        await supabase.auth.refreshSession();
      } catch (err) {
        console.error("Background upload failed:", err);
        alert(`Failed to save background: ${err.message || err}`);
      } finally {
        setBgUploading(false);
      }
    },
    [googleAccessToken, customBgDriveId]
  );

  const loadLibrary = useCallback(async () => {
    setLibraryLoaded(false);
    if (!user?.id) return;
    try {
      const records = await getUserLibrary(user.id);

      const formattedPromises = records.map(async (rec) => {
        const trackObj = rec.tracks || {};

        const meta = Array.isArray(trackObj.track_metadata)
          ? trackObj.track_metadata[0] || {}
          : trackObj.track_metadata || {};

        const lyricsObj = Array.isArray(trackObj.track_lyrics)
          ? trackObj.track_lyrics[0] || {}
          : trackObj.track_lyrics || {};

        const artistObj = Array.isArray(trackObj.artists)
          ? trackObj.artists[0] || {}
          : trackObj.artists || {};

        const title = trackObj.canonical_title || rec.uploaded_filename || "Untitled Track";
        const artist = artistObj.name || trackObj.canonical_artist || "Unknown Artist";

        let coverUrl = meta.artwork_url || meta.artworkUrl;

        if (!coverUrl || coverUrl === DEFAULT_BG_IMAGE) {
          try {
            const iTunesCover = await fetchArtworkFromITunes(title, artist);
            coverUrl = iTunesCover || `https://picsum.photos/seed/${encodeURIComponent(title)}/400/400`;
          } catch (err) {
            console.warn("[App] iTunes artwork fetch failed for", title, err);
            coverUrl = `https://picsum.photos/seed/${encodeURIComponent(title)}/400/400`;
          }
        }

        return {
          id: trackObj.id || rec.track_id || rec.id,
          user_track_id: rec.id,
          drive_file_id: rec.drive_file_id || rec.driveFileId,
          uploaded_filename: rec.uploaded_filename || rec.uploadedFilename || "",
          uploadedAt: rec.created_at,
          title,
          artist,
          artist_id: trackObj.artist_id || null,
          artistPhotoUrl: artistObj.photo_url || artistObj.photoUrl || "",
          artistIsFavorite: !!(
            Array.isArray(artistObj.favorite_artists)
              ? artistObj.favorite_artists.length
              : artistObj.favorite_artists
          ),
          genre: meta.primary_genre || meta.primaryGenre || "Unknown",
          cover: coverUrl,
          artworkUrl: coverUrl,
          synced_lyrics: lyricsObj.synced_lyrics || lyricsObj.syncedLyrics || "",
          duration: trackObj.duration_seconds || 0,
        };
      });

      const formatted = await Promise.all(formattedPromises);

      const uniqueTracks = [];
      const seenIds = new Set();
      for (const track of formatted) {
        if (!track.id || seenIds.has(track.id)) continue;
        seenIds.add(track.id);
        uniqueTracks.push(track);
      }
      setUserTracks(uniqueTracks);
    } catch (err) {
      console.error("Failed to load library:", err);
    } finally {
      setLibraryLoaded(true);
    }
  }, [user?.id]);

  const loadContinueListening = useCallback(async () => {
    if (!user?.id) return;
    try {
      const history = await getListeningHistoryWithGenres(user.id, 50);
      const seen = new Set();
      const unique = [];
      for (const h of history) {
        if (!h.track_id || seen.has(h.track_id)) continue;
        seen.add(h.track_id);
        unique.push(h);
      }
      setListeningHistory(unique);
      setPlayedTrackIds(unique.map((h) => h.track_id));
    } catch (err) {
      console.error("Failed to load continue listening:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      await loadLibrary();
      await loadContinueListening();
      await loadUserPreferences();
    };
    load();
  }, [loadLibrary, loadContinueListening, loadUserPreferences]);

  const handlePlayTrack = useCallback((track, playlistId = null) => {
    // A user explicitly picking a song exits radio mode; radio auto-advance
    // (which sets radioAutoPlayRef) keeps it on.
    if (!radioAutoPlayRef.current) {
      setIsRadioMode(false);
    }
    radioAutoPlayRef.current = false;
    setActiveTrack({
      id: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover || track.artworkUrl,
      artworkUrl: track.artworkUrl || track.cover,
      synced_lyrics: track.synced_lyrics || track.syncedLyrics || "",
      driveFileId: track.drive_file_id || track.driveFileId,
      genre: track.genre || track.primary_genre || "Unknown",
    });
    setActivePlaylistId(playlistId);
    setPlayedTrackIds((prev) => {
      const filtered = prev.filter((id) => id !== track.id);
      return [track.id, ...filtered].slice(0, 8);
    });
    if (user?.id) {
      recordListen(user.id, track.id, track.genre || track.primary_genre || "Unknown");
    }
    setCurrentTime(0);
    setSeekTime(0);
    setIsPlaying(true);
  }, [user?.id]);

  const handleSeek = useCallback((time) => {
    if (isRadioMode) return;
    setSeekTime(time);
    setCurrentTime(time);
  }, [isRadioMode]);

  // Tune a station's "live broadcast": resolve where it is right now via the
  // session timeline anchor and play from that offset.
  const playRadioStation = useCallback(
    (station) => {
      const result = tuneIn(station);
      if (!result) return;
      setRadioStation(station);
      setIsRadioMode(true);
      radioAutoPlayRef.current = true;
      handlePlayTrack(result.track);
      setCurrentTime(result.offsetSeconds || 0);
      setSeekTime(result.offsetSeconds || 0);
    },
    [tuneIn, handlePlayTrack]
  );

  const radioAutoPlayRef = useRef(false);

  const handleTogglePlay = useCallback(() => {
    if (isRadioMode) {
      if (isPlaying) {
        setIsPlaying(false);
      } else {
        // The broadcast keeps running while paused — re-tune to the live position.
        playRadioStation(radioStation);
      }
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [isRadioMode, isPlaying, playRadioStation, radioStation]);

    const genrePlaylists = useMemo(() => {
    const byGenre = new Map();
    for (const t of userTracks) {
      const genre = String(t.genre || "Unknown").trim();
      if (genre === "Unknown" || genre === "Music") continue;
      if (!byGenre.has(genre)) byGenre.set(genre, []);
      byGenre.get(genre).push(t.id);
    }
    const list = [];
    for (const [genre, songIds] of byGenre) {
      if (songIds.length < 2) continue;
      list.push({
        id: `genre:${genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: genre,
        isGenrePlaylist: true,
        songIds,
      });
    }
    return list;
  }, [userTracks]);

  const getActiveQueue = useCallback(() => {
    if (activePlaylistId) {
      const playlist =
        (activePlaylistId === "recommended" ? recommendedPlaylist : null) ||
        genrePlaylists.find((p) => p.id === activePlaylistId) ||
        playlists.find((p) => p.id === activePlaylistId);
      if (playlist) {
        const queue = (playlist.songIds || [])
          .map((id) => userTracks.find((t) => t.id === id))
          .filter(Boolean);
        if (queue.length > 0) return queue;
      }
    }
    return userTracks;
  }, [activePlaylistId, playlists, recommendedPlaylist, genrePlaylists, userTracks]);

  const generateRecommended = useCallback(
    (rotate = false) => {
      if (userTracks.length === 0) return;
      const pool = userTracks.filter((t) => t.id !== activeTrack?.id);
      let recs = getRecommendedTracks(activeTrack, pool, listeningHistory, 10 + 5);
      if (recs.length === 0) recs = userTracks;
      let recIds = recs.map((t) => t.id);

      if (rotate && recommendedPlaylist?.songIds?.length) {
        const prev = recommendedPlaylist.songIds;
        const exitCount = Math.min(5, Math.round(prev.length * 0.2));
        const removed = new Set(
          [...prev].sort(() => Math.random() - 0.5).slice(0, exitCount)
        );
        const kept = prev.filter((id) => !removed.has(id));
        const fresh = recIds.filter((id) => !kept.includes(id));
        recIds = [...kept, ...fresh].slice(0, 10);
      } else {
        recIds = recIds.slice(0, 10);
      }

      setRecommendedPlaylist({
        id: "recommended",
        title: "Playlist made for you",
        isRecommended: true,
        songIds: recIds,
      });
      const now = Date.now();
      setRecommendedGeneratedAt(now);
      localStorage.setItem("spire:rec:generatedAt", String(now));
      localStorage.setItem("spire:rec:songIds", JSON.stringify(recIds));
    },
    [userTracks, activeTrack, listeningHistory, recommendedPlaylist]
  );

  useEffect(() => {
    if (!userTracks.length) return;
    const needsRefresh =
      !recommendedPlaylist || Date.now() - recommendedGeneratedAt >= 24 * 60 * 60 * 1000;
    if (needsRefresh) generateRecommended(Boolean(recommendedPlaylist));
  }, [userTracks, recommendedPlaylist, recommendedGeneratedAt, generateRecommended]);

  const handleSaveRecommendedPlaylist = useCallback(async () => {
    if (!user?.id || !recommendedPlaylist?.songIds?.length) return;
    try {
      const newPlaylist = await createPlaylist(user.id, "Playlist made for you");
      for (const trackId of recommendedPlaylist.songIds) {
        await addTrackToPlaylist(newPlaylist.id, trackId);
      }
      setPlaylists((prev) => [
        ...prev,
        { ...newPlaylist, songIds: recommendedPlaylist.songIds },
      ]);
    } catch (err) {
      console.error("Failed to save recommended playlist:", err);
    }
  }, [user?.id, recommendedPlaylist]);

  const handleNextTrack = useCallback(() => {
    if (isRadioMode) return;
    if (!activeTrack) return;
    const queue = getActiveQueue();
    if (queue.length === 0) return;

    const idx = queue.findIndex((t) => t.id === activeTrack.id);

    if (isShuffle && queue.length > 1) {
      let r;
      do {
        r = Math.floor(Math.random() * queue.length);
      } while (r === idx);
      handlePlayTrack(queue[r], activePlaylistId);
      return;
    }

    if (idx < 0) {
      handlePlayTrack(queue[0], activePlaylistId);
      return;
    }

    if (queue.length === 1) {
      if (!isRepeat) {
        setCurrentTime(0);
        setSeekTime(0);
        setIsPlaying(true);
      }
      return;
    }

    const nextIdx = (idx + 1) % queue.length;
    handlePlayTrack(queue[nextIdx], activePlaylistId);
  }, [activeTrack, getActiveQueue, isShuffle, activePlaylistId, isRepeat, isRadioMode, handlePlayTrack]);

  const handlePreviousTrack = useCallback(() => {
    if (isRadioMode) return;
    if (!activeTrack) return;
    const queue = getActiveQueue();
    if (queue.length === 0) return;

    const idx = queue.findIndex((t) => t.id === activeTrack.id);
    if (idx < 0) {
      handlePlayTrack(queue[0], activePlaylistId);
      return;
    }

    const prevIdx = (idx - 1 + queue.length) % queue.length;
    handlePlayTrack(queue[prevIdx], activePlaylistId);
  }, [activeTrack, getActiveQueue, activePlaylistId, isRadioMode, handlePlayTrack]);

  useEffect(() => {
    if (!activeTrack && isExpandedViewOpen) {
      setIsExpandedViewOpen(false);
    }
  }, [activeTrack, isExpandedViewOpen]);

  const handleTrackEnded = useCallback(() => {
    if (isRadioMode) {
      playRadioStation(radioStation);
      return;
    }
    handleNextTrack();
  }, [isRadioMode, playRadioStation, radioStation, handleNextTrack]);

  const handleToggleRadio = useCallback(() => {
    const next = !isRadioMode;
    if (next) {
      playRadioStation(radioStation);
    } else {
      setIsRadioMode(false);
      setActiveTrack(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setSeekTime(0);
    }
  }, [isRadioMode, playRadioStation, radioStation]);

  // Selecting a station in the MusicBar tuner: remember it and tune in —
  // radio mode turns on and the station's broadcast resumes from its live position.
  const handleSelectRadioStation = useCallback(
    (station) => {
      if (!station) return;
      playRadioStation(station);
    },
    [playRadioStation]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      const el = e.target;
      const tag = el && el.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (el && el.isContentEditable)
      ) {
        return;
      }

      switch (e.key) {
        case "k":
        case "K":
          e.preventDefault();
          handleTogglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSeek(Math.max(0, Math.min(duration, currentTime - 10)));
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSeek(Math.max(0, Math.min(duration, currentTime + 10)));
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((v) => Math.min(100, v + 5));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 5));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentTime, duration, handleTogglePlay, handleSeek, setVolume]);

  const handleFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!googleAccessToken) {
        alert("Please login with Google first.");
        return;
      }

      const existing = userTracks.find((t) => t.uploaded_filename === file.name);
      if (existing) {
        const reupload = window.confirm(
          `"${file.name}" is already in your library.\n\nUpload again?`
        );
        if (!reupload) return;
      }

      setUploadFile(file);
      setIsUploadModalOpen(true);
      setUploadStep(1);
      setUploadError("");
      setUploadProgress(25);

      try {
        const result = await processAudioUpload(file, user, googleAccessToken, (progress) => {
          setUploadStep(progress.step);
          setUploadProgress(progress.percent);
        });

        const coverUrl = result.track?.artworkUrl || null;
        const newTrack = {
          id: result.userTrackRecord?.track_id || result.track?.title,
          user_track_id: result.userTrackRecord?.id,
          drive_file_id: result.driveFileId,
          uploaded_filename: file.name,
          uploadedAt: result.userTrackRecord?.created_at || new Date().toISOString(),
          title: result.track?.title || file.name,
          artist: result.track?.artist || "Unknown Artist",
          genre: result.track?.primaryGenre || "Unknown",
          cover: coverUrl,
          artworkUrl: coverUrl,
          synced_lyrics: result.lyrics?.syncedLyrics || "",
          duration: result.track?.durationSeconds || 0,
        };
        setUserTracks((prev) =>
          prev.some((t) => t.id === newTrack.id) ? prev : [...prev, newTrack]
        );
      } catch (err) {
        console.error("Upload error:", err);
        setUploadError(err.message || "Upload failed");
      }
    },
    [googleAccessToken, user, userTracks]
  );

  const artistSyncInFlight = useRef(false);
  const artistAutoSyncDone = useRef({});

  const autoSyncArtistPhotos = useCallback(async () => {
    if (!user?.id || artistSyncInFlight.current) return;
    artistSyncInFlight.current = true;
    try {
      const artists = await getDistinctArtistsWithIds(user.id);
      const isPlaceholderPhoto = (url) =>
        !url ||
        url.includes("cw.png") ||
        url.includes("picsum") ||
        url.includes("saleminteractivemedia") ||
        url === DEFAULT_BG_IMAGE;
      const missing = artists.filter((a) => isPlaceholderPhoto(a.photo_url));
      const updates = new Map();
      for (const artist of missing) {
        const photoUrl = await fetchArtistPhoto(artist.name);
        if (photoUrl) {
          await updateArtistPhoto(artist.id, photoUrl);
          updates.set(artist.id, photoUrl);
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (updates.size > 0) {
        setUserTracks((prev) =>
          prev.map((t) =>
            updates.has(t.artist_id) ? { ...t, artistPhotoUrl: updates.get(t.artist_id) } : t
          )
        );
      }
    } catch (err) {
      console.error("Auto artist photo sync failed:", err);
    } finally {
      artistSyncInFlight.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || userTracks.length === 0) return;
    if (artistAutoSyncDone.current[user.id]) return;
    artistAutoSyncDone.current[user.id] = true;
    autoSyncArtistPhotos();
  }, [user?.id, userTracks.length, autoSyncArtistPhotos]);

  const toggleLikeTrack = useCallback(
    async (trackId) => {
      if (!trackId || !user?.id) return;
      const wasLiked = likedTrackIds.has(trackId);

      setLikedTrackIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(trackId);
        else next.add(trackId);
        return next;
      });

      try {
        await toggleLikedSong(user.id, trackId, wasLiked);
      } catch (err) {
        console.error("Failed to toggle like:", err);
        setLikedTrackIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(trackId);
          else next.delete(trackId);
          return next;
        });
      }
    },
    [user?.id, likedTrackIds]
  );

  const handleAddToPlaylist = useCallback(
    async (playlistId, trackId) => {
      if (!trackId) return;

      if (playlistId === "1") {
        await toggleLikeTrack(trackId);
        return;
      }

      let alreadyThere = false;
      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id === playlistId) {
            const songIds = pl.songIds || [];
            if (songIds.includes(trackId)) {
              alreadyThere = true;
              return pl;
            }
            return { ...pl, songIds: [...songIds, trackId] };
          }
          return pl;
        })
      );

      if (alreadyThere) return;

      try {
        await addTrackToPlaylist(playlistId, trackId);
      } catch (err) {
        console.error("Failed to add to playlist:", err);
        setPlaylists((prev) =>
          prev.map((pl) =>
            pl.id === playlistId
              ? { ...pl, songIds: (pl.songIds || []).filter((id) => id !== trackId) }
              : pl
          )
        );
      }
    },
    [toggleLikeTrack]
  );

  const handleCreatePlaylist = useCallback(
    async (title) => {
      if (!user?.id || !title.trim()) return;
      try {
        const newPlaylist = await createPlaylist(user.id, title.trim());
        setPlaylists((prev) => [...prev, newPlaylist]);
      } catch (err) {
        console.error("Failed to create playlist:", err);
      }
    },
    [user?.id]
  );

  const handleDeletePlaylist = useCallback(
    async (playlistId) => {
      if (playlistId === "1") return;
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      try {
        await deletePlaylist(playlistId);
      } catch (err) {
        console.error("Failed to delete playlist:", err);
        await loadUserPreferences();
      }
    },
    [loadUserPreferences]
  );

  const handleRenamePlaylist = useCallback(
    async (playlistId, newTitle) => {
      if (playlistId === "1") return;
      const trimmed = (newTitle || "").trim();
      if (!trimmed) return;
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, title: trimmed } : p))
      );
      try {
        await renamePlaylist(playlistId, trimmed);
      } catch (err) {
        console.error("Failed to rename playlist:", err);
        await loadUserPreferences();
      }
    },
    [loadUserPreferences]
  );

  const handleRemoveTrackFromPlaylist = useCallback(
    async (playlistId, trackId) => {
      if (playlistId === "1") {
        await toggleLikeTrack(trackId);
        return;
      }
      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId
            ? { ...pl, songIds: (pl.songIds || []).filter((id) => id !== trackId) }
            : pl
        )
      );
      try {
        await removeTrackFromPlaylist(playlistId, trackId);
      } catch (err) {
        console.error("Failed to remove track from playlist:", err);
        await loadUserPreferences();
      }
    },
    [toggleLikeTrack, loadUserPreferences]
  );

  const handlePlaylistPlay = useCallback(
    (playlistId, track) => {
      setActivePlaylistId(playlistId);
      handlePlayTrack(track, playlistId);
    },
    [handlePlayTrack]
  );

  const handleListenRemote = useCallback(
    (state) => {
      if (!state?.track?.id) return;
      const { track, isPlaying, currentTime } = state;
      if (activeTrack?.id !== track.id) {
        setActiveTrack({
          id: track.id,
          title: track.title || "Untitled Track",
          artist: track.artist || "Unknown Artist",
          cover: track.cover || track.artworkUrl,
          artworkUrl: track.artworkUrl || track.cover,
          synced_lyrics: track.synced_lyrics || "",
          driveFileId: track.driveFileId,
          genre: track.genre || "Unknown",
        });
        setActivePlaylistId(null);
        setCurrentTime(0);
        setSeekTime(currentTime);
        setIsPlaying(isPlaying);
      } else {
        setIsPlaying(isPlaying);
        handleSeek(currentTime);
      }
    },
    [activeTrack?.id, handleSeek]
  );

  const listenTogether = useListenTogether({
    name:
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "Guest",
    playback: { track: activeTrack, isPlaying, currentTime },
    onRemoteState: handleListenRemote,
  });

  const [discordUser, setDiscordUser] = useState(getDiscordUser());
  const [isDiscordConnecting, setIsDiscordConnecting] = useState(false);
  const [discordError, setDiscordError] = useState("");

  const discordPlaybackRef = useRef({ track: null, isPlaying: false, currentTime: 0 });
  discordPlaybackRef.current = { track: activeTrack, isPlaying, currentTime };

  const handleConnectDiscord = useCallback(async () => {
    setIsDiscordConnecting(true);
    setDiscordError("");
    try {
      const me = await connectDiscord();
      setDiscordUser(me);
    } catch (err) {
      console.error("Discord connect failed:", err);
      setDiscordError(
        err?.code === "NOT_IN_DISCORD"
          ? "Run Spire inside Discord (Activities) to connect. Listen Together rooms still sync playback across users."
          : `Couldn't reach Discord: ${err?.message || "unknown error"}`
      );
    } finally {
      setIsDiscordConnecting(false);
    }
  }, []);

  useEffect(() => {
    if (!discordUser) return;
    const { track, isPlaying: playing, currentTime: time } = discordPlaybackRef.current;
    setDiscordActivity(track, playing, time);
  }, [discordUser, activeTrack?.id, isPlaying]);

  // NEW: wraps refreshGoogleToken so AudioPlayer's retry-on-401 can surface
  // a clear "reconnect" prompt instead of failing silently when Supabase
  // cannot produce a genuinely fresh Google provider_token.
  const handleRefreshToken = useCallback(async () => {
    const fresh = await refreshGoogleToken();
    if (!fresh) {
      setNeedsReauth(true);
    } else {
      setNeedsReauth(false);
    }
    return fresh;
  }, [refreshGoogleToken]);

  // NEW: clear the reauth banner once the user reconnects successfully.
  useEffect(() => {
    if (googleAccessToken) {
      setNeedsReauth(false);
    }
  }, [googleAccessToken]);

  if (!user && !loading) {
    return (
      <div
        className="h-screen w-screen bg-cover bg-center bg-no-repeat text-white flex flex-col items-center justify-center p-4 relative"
        style={{ backgroundImage: `url("${DEFAULT_BG_IMAGE}")` }}
      >
        <div className="absolute inset-0 z-0 bg-black/30 gap-2" />
        <TemperedGlassCard className="z-10 w-full max-w-md space-y-6 p-10 text-center">
          <div className="flex flex-col items-center gap-3">
             <img src="/spire.png" alt="spire logo " className="w-8 h-8" />
            <h1 className="text-2xl font-bold  text-white/80">Welcome back!</h1>
            <p className="text-white/50 text-[0.675rem] mb-2 font-light">Please continue with google to start using spire</p>
          </div>
          <GlassButton
            onClick={signInWithGoogle}
            glassVariant="liquid-refract"
            className="w-full rounded-xl py-5 font-semibold text-white hover:bg-white/10 transition duration-300 flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </GlassButton>
        </TemperedGlassCard>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black text-white flex items-center justify-center">
        <div className="text-sm text-white/70">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen text-white font-sans flex flex-col relative overflow-hidden select-none">
      {/* Background Layers */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
        style={{ backgroundImage: `url("${prevBg}")` }}
      />
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0 transition-opacity duration-1000 ease-in-out ${
          isFading ? "opacity-0" : "opacity-100"
        }`}
        style={{ backgroundImage: `url("${currentBg}")` }}
      />
      <div className="absolute inset-0 pointer-events-none z-0 bg-black/10 backdrop-blur-[1px]" />

      {/* NEW: Reauth banner — shown when Google Drive token refresh genuinely fails */}
      {needsReauth && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2 bg-red-500/90 text-white text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          <span>Your Google session expired.</span>
          <button
            onClick={signInWithGoogle}
            className="underline font-semibold hover:text-white/80 transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Audio Engine */}
      <AudioPlayer
        activeTrack={activeTrack}
        googleAccessToken={googleAccessToken}
        isPlaying={isPlaying}
        volume={volume}
        seekTime={seekTime}
        onTimeUpdate={setCurrentTime}
        onDurationChange={setDuration}
        onEnded={handleTrackEnded}
        onRefreshToken={handleRefreshToken}
      />

      {isExpandedViewOpen ? (
        <ExpandedLyricsView
          activeTrack={activeTrack}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          setVolume={setVolume}
          onSeek={handleSeek}
          onNext={handleNextTrack}
          onPrevious={handlePreviousTrack}
          isShuffle={isShuffle}
          onToggleShuffle={() => setIsShuffle((v) => !v)}
          isRepeat={isRepeat}
          onToggleRepeat={() => setIsRepeat((v) => !v)}
          isRadioMode={isRadioMode}
          radioStation={radioStation}
          onSelectRadioStation={setRadioStation}
          onToggleRadio={handleToggleRadio}
          onClose={() => setIsExpandedViewOpen(false)}
          initialLyrics={startInLyrics}
          isLiked={activeTrack?.id ? likedTrackIds.has(activeTrack.id) : false}
          onToggleLike={() => toggleLikeTrack(activeTrack?.id)}
          playlists={playlists}
          onAddToPlaylist={handleAddToPlaylist}
           onPlayTrack={handlePlayTrack}
           userTracks={userTracks}
         />
      ) : (
        <>
          {/* Floating Left Bar */}
          <FloatingBar />

          <main className="flex-1 min-h-0 h-full overflow-hidden max-w-6xl w-full mx-auto px-6 pl-0 md:pl-20 pt-6 pb-2 flex flex-col relative z-10">

            <div className="shrink-0 mb-4 relative z-[100]">
   <GlassSearchBar
     onSelectSong={(selectedTrack) => {
      handlePlayTrack(selectedTrack);
      navigate("/");
    }}
     onSearch={(query) => {
       setSearchQuery(query);
       navigate("/");
     }}
     onThemeToggle={handleThemeToggle}
  />
</div>
            <TemperedGlassCard surfaceClassName="flex flex-col h-full" className="relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden">

              <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
                <Routes>
                  <Route
                    path="/"
                    element={
                      <HomeView
                        userTracks={userTracks}
                        searchQuery={searchQuery}
                        isUploading={uploadStep > 0 && uploadStep < 4}
                        onFileUpload={handleFileUpload}
                        onPlayTrack={handlePlayTrack}
                        playlists={playlists}
                        onAddToPlaylist={handleAddToPlaylist}
                      />
                    }
                  />
                  <Route
                    path="/explore"
                    element={
                       <ExploreView
                         userTracks={userTracks}
                         onPlayTrack={handlePlayTrack}
                         currentTrack={activeTrack}
                         continueListening={continueListening}
                         playlists={playlists}
                         onAddToPlaylist={handleAddToPlaylist}
                         listeningHistory={listeningHistory}
                       />
                    }
                  />
                  <Route
                    path="/playlists"
                    element={
                      <PlaylistsView
                        playlists={playlists}
                        userTracks={userTracks}
                        onPlayTrack={handlePlayTrack}
                        onPlaylistPlay={handlePlaylistPlay}
                        onCreatePlaylist={handleCreatePlaylist}
                        onDeletePlaylist={handleDeletePlaylist}
                        onRenamePlaylist={handleRenamePlaylist}
                        onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                        onAddToPlaylist={handleAddToPlaylist}
                        recommendedPlaylist={recommendedPlaylist}
                        genrePlaylists={genrePlaylists}
                        onSaveRecommended={handleSaveRecommendedPlaylist}
                      />
                    }
                  />

                  <Route
                    path="/artist/:artistName"
                    element={
                      <ArtistPageRoute
                        userTracks={userTracks}
                        onPlayTrack={handlePlayTrack}
                        playlists={playlists}
                        onAddToPlaylist={handleAddToPlaylist}
                        isLibraryLoading={!libraryLoaded}
                      />
                    }
                  />

                  <Route
                    path="/settings"
                    element={
                      <SettingsView
                        user={user}
                        isUploading={bgUploading}
                        onBackgroundUpload={handleBackgroundUpload}
                        onSignOut={signOut}
                        listen={listenTogether}
                        discordUser={discordUser}
                        isDiscordConnecting={isDiscordConnecting}
                        discordError={discordError}
                        onConnectDiscord={handleConnectDiscord}
                      />
                    }
                  />
                </Routes>
              </div>
            </TemperedGlassCard>
          </main>

          {/* FIXED FOOTER PLAYER */}
          <footer className="shrink-0 z-40 p-2">
            <MobileNav />
            <MusicBar
              activeTrack={activeTrack}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              setVolume={setVolume}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle((v) => !v)}
              isRepeat={isRepeat}
              onToggleRepeat={() => setIsRepeat((v) => !v)}
              isRadioMode={isRadioMode}
              radioStation={radioStation}
              onSelectRadioStation={setRadioStation}
              onStationChange={handleSelectRadioStation}
              onToggleRadio={handleToggleRadio}
              onSeek={handleSeek}
              onNext={handleNextTrack}
              onPrevious={handlePreviousTrack}
              onOpenExpandedView={() => {
            if (!activeTrack) return;
            setStartInLyrics(false);
            setIsExpandedViewOpen(true);
          }}
          onOpenLyrics={() => {
            if (!activeTrack) return;
            setStartInLyrics(true);
            setIsExpandedViewOpen(true);
          }}
              isLiked={activeTrack?.id ? likedTrackIds.has(activeTrack.id) : false}
              onToggleLike={() => toggleLikeTrack(activeTrack?.id)}
              playlists={playlists}
              onAddToPlaylist={handleAddToPlaylist}
            />
          </footer>
        </>
      )}

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setUploadStep(0);
        }}
        file={uploadFile}
        currentStep={uploadStep}
        uploadProgress={uploadProgress}
        errorMessage={uploadError}
      />
    </div>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(() => {
    return sessionStorage.getItem("spire_screen") || "opening";
  });

  const handleScreenChange = (screen) => {
    sessionStorage.setItem("spire_screen", screen);
    setCurrentScreen(screen);
  };

  if (currentScreen === "opening") {
    return <Opening onComplete={() => handleScreenChange("landing")} />;
  }

  if (currentScreen === "landing") {
    return <Landing onLaunchSpire={() => handleScreenChange("app")} />;
  }

  return <AppContent />;
}

function ArtistPageRoute({ isLibraryLoading, ...rest }) {
  return <ArtistView {...rest} isLibraryLoading={isLibraryLoading} />;
}