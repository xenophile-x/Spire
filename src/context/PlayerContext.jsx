import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLibrary } from "@/context/LibraryContext";
import AudioPlayer from "@/components/AudioPlayer";
import { useSpatialAudio } from "@/hooks/useSpatialAudio";
import { useRadioBroadcast } from "@/hooks/useRadioBroadcast";
import { getRecommendedTracks } from "@/utils/recommend";
import { buildStationQueue } from "@/utils/stationQueue";
import { trackMatchesArtist } from "@/utils/artistNames";
import { getStationAnchor, setStationAnchor } from "@/utils/radioTimeline";
import { RADIO_STATIONS } from "@/constants/radioStations";
import { recordListen } from "@/services/supabaseService";
import { preloadAudio, preloadAudioRange, preloadFullTrack } from "@/utils/audioSource";


const PlayerTimeContext = React.createContext({ currentTime: 0 });

const PlayerContext = React.createContext(null);

const PlayerControlsContext = React.createContext(null);

const SEEK_TOLERANCE_S = 1.5;

export function PlayerProvider({ children }) {
  const { user, googleAccessToken } = useAuth();
  const {
    userTracks,
    playlists,
    recommendedPlaylist,
    genrePlaylists,
    listeningHistory,
    setPlayedTrackIds,
    setRecommendedPlaylist,
    setRecommendedGeneratedAt,
    recommendedGeneratedAt,
  } = useLibrary();

  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [seekTime, setSeekTime] = useState(null);
  const [volume, setVolume] = useState(85);
  const karaokeAudioElementRef = useRef(null);
  const spatialAudio = useSpatialAudio(karaokeAudioElementRef);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [radioStation, setRadioStation] = useState(RADIO_STATIONS[0]);


  const [radioTick, setRadioTick] = useState(0);


  const [reloadTick, setReloadTick] = useState(0);
  const [activePlaylistId, setActivePlaylistId] = useState(null);


  const explicitQueueRef = useRef({ playlistId: null, tracks: [] });


  const [activeArtist, setActiveArtist] = useState(null);


  const [needsReauth, setNeedsReauth] = useState(false);

  const [isBuffering, setIsBuffering] = useState(false);


  const currentTimeRef = useRef(0);
  const [timeState, setTimeState] = useState(0);
  const setCurrentTime = useCallback((t) => {
    currentTimeRef.current = t;
    setTimeState(t);
  }, []);


  const playbackRef = useRef({ track: null, isPlaying: false, currentTime: 0 });
  playbackRef.current = { track: activeTrack, isPlaying, currentTime: currentTimeRef.current };

  const radioAutoPlayRef = useRef(false);

  useEffect(() => {
    if (googleAccessToken) {
      setNeedsReauth(false);
    }
  }, [googleAccessToken]);

  const handlePlayTrack = useCallback(
    (track, playlistId = null, artist = null) => {


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
        user_id: track.user_id || track.userId || track.owner_id || user?.id,
      });
      setActivePlaylistId(playlistId);
      setActiveArtist(artist || null);
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
    },
    [user?.id, setPlayedTrackIds, setCurrentTime]
  );

  const handleSeek = useCallback(
    (time) => {
      if (isRadioMode) return;
      setSeekTime(time);
      setCurrentTime(time);
    },
    [isRadioMode, setCurrentTime]
  );

  const { tuneIn } = useRadioBroadcast(userTracks);


  const playRadioStation = useCallback(
    (station) => {
      const result = tuneIn(station);
      if (!result) return;
      setRadioStation(station);
      setIsRadioMode(true);
      radioAutoPlayRef.current = true;
      setRadioTick((t) => t + 1);
      handlePlayTrack(result.track);
      setCurrentTime(result.offsetSeconds || 0);
      setSeekTime(result.offsetSeconds || 0);
    },
    [tuneIn, handlePlayTrack, setCurrentTime]
  );

  const radioPausedAtRef = useRef(null);

  const handleTogglePlay = useCallback(() => {
    if (isRadioMode) {
      if (isPlaying) {
        radioPausedAtRef.current = Date.now();
        setIsPlaying(false);
      } else {
        const pausedFor = radioPausedAtRef.current ? Date.now() - radioPausedAtRef.current : 0;
        radioPausedAtRef.current = null;
        if (pausedFor > 30000) {
          playRadioStation(radioStation);
        } else {
          setIsPlaying(true);
        }
      }
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [isRadioMode, isPlaying, playRadioStation, radioStation]);

  const getActiveQueue = useCallback(() => {
    if (activeArtist) {


      const artistQueue = userTracks
        .filter((t) => trackMatchesArtist(t, activeArtist))
        .sort(
          (a, b) =>
            new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
        );
      if (artistQueue.length > 0) return artistQueue;
    }


    const explicit = explicitQueueRef.current;
    if (
      activePlaylistId &&
      explicit.playlistId === activePlaylistId &&
      explicit.tracks.length > 0
    ) {

      const queue = explicit.tracks.filter((t) =>
        userTracks.some((u) => u.id === t.id)
      );
      if (queue.length > 0) return queue;
      explicitQueueRef.current = { playlistId: null, tracks: [] };
    }
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
  }, [activePlaylistId, activeArtist, playlists, recommendedPlaylist, genrePlaylists, userTracks]);

  const handleNextTrack = useCallback(() => {
    if (isRadioMode) {


      const queue = buildStationQueue(radioStation, userTracks);
      if (queue.length === 0) return;
      const anchor = getStationAnchor(radioStation.id);
      const idx = anchor ? (anchor.trackIndex + 1) % queue.length : 0;
      setStationAnchor(radioStation.id, { trackIndex: idx, offsetSeconds: 0 });
      playRadioStation(radioStation);
      return;
    }
    if (!activeTrack) return;
    const queue = getActiveQueue();
    if (queue.length === 0) return;

    const idx = queue.findIndex((t) => t.id === activeTrack.id);

    if (isShuffle && queue.length > 1) {
      let r;
      do {
        r = Math.floor(Math.random() * queue.length);
      } while (r === idx);
      handlePlayTrack(queue[r], activePlaylistId, activeArtist);
      return;
    }

    if (idx < 0) {
      handlePlayTrack(queue[0], activePlaylistId, activeArtist);
      return;
    }

    if (queue.length === 1) {
      if (isRepeat) {


        setCurrentTime(0);
        setSeekTime(0);
        setIsPlaying(true);
        setReloadTick((t) => t + 1);
      } else {


        setIsPlaying(false);
      }
      return;
    }

    const nextIdx = (idx + 1) % queue.length;
    handlePlayTrack(queue[nextIdx], activePlaylistId, activeArtist);
  }, [activeTrack, getActiveQueue, isShuffle, activePlaylistId, isRepeat, isRadioMode, handlePlayTrack, radioStation, userTracks, playRadioStation, activeArtist, setCurrentTime]);

  const handlePreviousTrack = useCallback(() => {
    if (isRadioMode) {

      const queue = buildStationQueue(radioStation, userTracks);
      if (queue.length === 0) return;
      const anchor = getStationAnchor(radioStation.id);
      const idx = anchor
        ? (anchor.trackIndex - 1 + queue.length) % queue.length
        : 0;
      setStationAnchor(radioStation.id, { trackIndex: idx, offsetSeconds: 0 });
      playRadioStation(radioStation);
      return;
    }
    if (!activeTrack) return;
    const queue = getActiveQueue();
    if (queue.length === 0) return;

    const idx = queue.findIndex((t) => t.id === activeTrack.id);
    if (idx < 0) {
      handlePlayTrack(queue[0], activePlaylistId, activeArtist);
      return;
    }

    const prevIdx = (idx - 1 + queue.length) % queue.length;
    handlePlayTrack(queue[prevIdx], activePlaylistId, activeArtist);
  }, [activeTrack, getActiveQueue, activePlaylistId, isRadioMode, handlePlayTrack, radioStation, userTracks, playRadioStation, activeArtist]);

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
  }, [isRadioMode, playRadioStation, radioStation, setCurrentTime]);


  const handleSelectRadioStation = useCallback(
    (station) => {
      if (!station) return;
      playRadioStation(station);
    },
    [playRadioStation]
  );

  const handlePlaylistPlay = useCallback(
    (playlistId, track, tracks = null) => {


      if (tracks && tracks.length > 0) {
        explicitQueueRef.current = { playlistId, tracks };
      } else {
        explicitQueueRef.current = { playlistId: null, tracks: [] };
      }
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
        if (Math.abs(currentTimeRef.current - currentTime) > SEEK_TOLERANCE_S) {
          setSeekTime(currentTime);
          setCurrentTime(currentTime);
        }
      }
    },
    [activeTrack?.id, setCurrentTime, currentTimeRef]
  );


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
        title: "Made for you",
        isRecommended: true,
        songIds: recIds,
      });
      const now = Date.now();
      setRecommendedGeneratedAt(now);
      localStorage.setItem("spire:rec:generatedAt", String(now));
      localStorage.setItem("spire:rec:songIds", JSON.stringify(recIds));
    },
    [userTracks, activeTrack, listeningHistory, recommendedPlaylist, setRecommendedPlaylist, setRecommendedGeneratedAt]
  );

  useEffect(() => {
    if (!userTracks.length) return;
    const needsRefresh =
      !recommendedPlaylist || Date.now() - recommendedGeneratedAt >= 24 * 60 * 60 * 1000;
    if (needsRefresh) generateRecommended(Boolean(recommendedPlaylist));
  }, [userTracks, recommendedPlaylist, recommendedGeneratedAt, generateRecommended]);

  // Track which driveId we've already fully preloaded to avoid duplicate fetches
  const fullyPreloadedRef = useRef(null);

  useEffect(() => {
    if (!activeTrack || isRadioMode) return;
    const queue = getActiveQueue();
    if (queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === activeTrack.id);
    if (idx < 0) return;

    // Immediately resolve URL + download first 2MB (~10s of audio) for next track
    const next = queue[(idx + 1) % queue.length];
    const nextDriveId = next?.driveFileId || next?.drive_file_id || next?.drive_id;
    if (nextDriveId) {
      preloadAudio(nextDriveId, next);
      preloadAudioRange(nextDriveId, 0, 2 * 1024 * 1024, next);
    }

    // Resolve URL only for next-next (lightweight — just cache the token+url)
    if (queue.length > 2) {
      const nextNext = queue[(idx + 2) % queue.length];
      const nnDriveId = nextNext?.driveFileId || nextNext?.drive_file_id || nextNext?.drive_id;
      if (nnDriveId) {
        preloadAudio(nnDriveId, nextNext);
        preloadAudioRange(nnDriveId, 0, 512 * 1024, nextNext);
      }
    }

    // Reset full-preload tracker when track changes
    fullyPreloadedRef.current = null;
  }, [activeTrack, isRadioMode, getActiveQueue]);

  // Time-based progressive preload: once current track is 60%+ done,
  // fully download the next song blob so switching is truly instant
  useEffect(() => {
    if (!activeTrack || isRadioMode || duration <= 0) return;
    const progressRatio = duration > 0 ? currentTimeRef.current / duration : 0;
    if (progressRatio < 0.6) return;

    const queue = getActiveQueue();
    if (queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === activeTrack.id);
    if (idx < 0) return;

    const next = queue[(idx + 1) % queue.length];
    const nextDriveId = next?.driveFileId || next?.drive_file_id || next?.drive_id;
    if (!nextDriveId || fullyPreloadedRef.current === nextDriveId) return;

    fullyPreloadedRef.current = nextDriveId;
    preloadFullTrack(nextDriveId, next);
  }, [timeState, activeTrack, duration, isRadioMode, getActiveQueue]);


  const controlsValue = useMemo(
    () => ({
      handlePlayTrack,
      handleSeek,
      handleTogglePlay,
      handleNextTrack,
      handlePreviousTrack,
      handleTrackEnded,
      handleToggleRadio,
      handleSelectRadioStation,
      handlePlaylistPlay,
      handleListenRemote,
      generateRecommended,
      getActiveQueue,
      setVolume,
      setIsShuffle,
      setIsRepeat,
      setNeedsReauth,
      setRadioStation,
    }),
    [
      handlePlayTrack,
      handleSeek,
      handleTogglePlay,
      handleNextTrack,
      handlePreviousTrack,
      handleTrackEnded,
      handleToggleRadio,
      handleSelectRadioStation,
      handlePlaylistPlay,
      handleListenRemote,
      generateRecommended,
      getActiveQueue,
    ]
  );

  const value = useMemo(
    () => ({
      activeTrack,
      setActiveTrack,
      isPlaying,
      setIsPlaying,
      duration,
      setDuration,
      seekTime,
      setSeekTime,
      volume,
      setVolume,
      isShuffle,
      setIsShuffle,
      isRepeat,
      setIsRepeat,
      isRadioMode,
      setIsRadioMode,
      radioStation,
      setRadioStation,
      radioTick,
      activePlaylistId,
      setActivePlaylistId,
      activeArtist,
      setActiveArtist,
      needsReauth,
      setNeedsReauth,
      isBuffering,
      currentTimeRef,
      playbackRef,
      setCurrentTime,
      karaokeAudioElementRef,
      spatialAudio,
      ...controlsValue,
    }),
    [
      activeTrack,
      isPlaying,
      duration,
      seekTime,
      volume,
      isShuffle,
      isRepeat,
      isRadioMode,
      radioStation,
      radioTick,
      activePlaylistId,
      activeArtist,
      needsReauth,
      isBuffering,
      currentTimeRef,
      playbackRef,
      setCurrentTime,
      karaokeAudioElementRef,
      spatialAudio,
      controlsValue,
    ]
  );

  const timeContextValue = useMemo(() => ({ currentTime: timeState }), [timeState]);

  return (
    <PlayerContext.Provider value={value}>
      <PlayerTimeContext.Provider value={timeContextValue}>
        <PlayerControlsContext.Provider value={controlsValue}>
          <AudioPlayer
            activeTrack={activeTrack}
            isPlaying={isPlaying}
            volume={volume}
            seekTime={seekTime}
            reloadKey={radioTick + reloadTick}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            onEnded={handleTrackEnded}
            elementRef={karaokeAudioElementRef}
            isRepeat={isRepeat}
            onBufferingChange={setIsBuffering}
          />
          {children}
        </PlayerControlsContext.Provider>
      </PlayerTimeContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = React.useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}

export function usePlayerControls() {
  return React.useContext(PlayerControlsContext) || {};
}

export function usePlayerTime() {
  return React.useContext(PlayerTimeContext);
}