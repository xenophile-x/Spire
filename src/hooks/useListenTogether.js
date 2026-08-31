import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6) {
  let code = "";
  const rand = new Uint32Array(length);
  crypto.getRandomValues(rand);
  for (let i = 0; i < length; i += 1) {
    code += ROOM_CODE_ALPHABET[rand[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

const BROADCAST_DEBOUNCE_MS = 2500;
const SEEK_TOLERANCE_S = 1.5;

function teardown(channelRef) {
  const channel = channelRef.current;
  if (!channel) return Promise.resolve();
  channelRef.current = null;
  return Promise.resolve(channel.untrack?.())
    .catch(() => {})
    .then(() => supabase.removeChannel(channel))
    .catch(() => {});
}

export function useListenTogether({
  name = "Guest",
  playback = { track: null, isPlaying: false, currentTime: 0 },
  onRemoteState = () => {},
  timeRef = null,
}) {
  const [status, setStatus] = useState("idle");
  const [roomCode, setRoomCode] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const channelRef = useRef(null);
  const statusRef = useRef("idle");
  const applyingRemoteRef = useRef(false);
  const lastBroadcastRef = useRef(0);
  const lastBroadcastTrackIdRef = useRef(null);
  const playbackRef = useRef(playback);
  const onRemoteStateRef = useRef(onRemoteState);

  playbackRef.current = playback;
  onRemoteStateRef.current = onRemoteState;
  statusRef.current = status;

  const liveTime = useCallback(
    () => (timeRef ? timeRef.current : playbackRef.current.currentTime),
    [timeRef]
  );

  const applyRemote = useCallback((state) => {
    applyingRemoteRef.current = true;
    onRemoteStateRef.current(state);
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 1000);
  }, []);

  const broadcast = useCallback(
    (force = false) => {
      if (statusRef.current !== "host") return;

      const channel = channelRef.current;
      const { track, isPlaying } = playbackRef.current;
      if (!channel || !track) return;
      if (applyingRemoteRef.current) return;

      const now = Date.now();
      const trackChanged = track.id !== lastBroadcastTrackIdRef.current;
      if (!force && !trackChanged && now - lastBroadcastRef.current < BROADCAST_DEBOUNCE_MS) {
        return;
      }
      lastBroadcastRef.current = now;
      lastBroadcastTrackIdRef.current = track.id;

      channel.send({
        type: "broadcast",
        event: "listen-state",
        payload: {
          track: {
            id: track.id,
            title: track.title,
            artist: track.artist,
            cover: track.cover || track.artworkUrl || null,
            artworkUrl: track.artworkUrl || track.cover || null,
            synced_lyrics: track.synced_lyrics || null,
            driveFileId: track.driveFileId || track.drive_file_id || null,
            genre: track.genre || null,
            duration: track.duration || null,
          },
          isPlaying: Boolean(isPlaying),
          currentTime: Number(liveTime()) || 0,
          ts: now,
          name,
        },
      });
    },
    [name, liveTime]
  );

  const subscribe = useCallback(
    (channel, onPresence) => {
      channel
        .on("broadcast", { event: "listen-state" }, ({ payload }) => {
          if (!payload?.track?.id || typeof payload.track.id !== "string") return;
          // Strict validation: reject oversized / non-uuid payloads to prevent injection
          if (payload.track.id.length > 64 || !/^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(payload.track.id)) return;
          const { track, isPlaying, currentTime, ts } = payload;
          // Sanitize track fields — never trust broadcast
          const sanitizedTrack = {
            id: String(track.id).slice(0, 64),
            title: String(track.title || "Untitled").slice(0, 120),
            artist: String(track.artist || "Unknown Artist").slice(0, 120),
            cover: track.cover ? String(track.cover).slice(0, 500) : null,
            artworkUrl: track.artworkUrl ? String(track.artworkUrl).slice(0, 500) : null,
            synced_lyrics: null, // never sync lyrics via broadcast (XSS surface, large payload)
            driveFileId: track.driveFileId ? String(track.driveFileId).slice(0, 100) : null,
            genre: track.genre ? String(track.genre).slice(0, 40) : null,
            duration: Number.isFinite(track.duration) ? Math.min(Math.max(0, Number(track.duration)), 36000) : null,
          };

          let targetTime = Number(currentTime) || 0;
          if (!Number.isFinite(targetTime) || targetTime < 0) targetTime = 0;
          targetTime = Math.min(targetTime, 36000);
          if (isPlaying && typeof ts === "number" && Number.isFinite(ts)) {
            targetTime += Math.max(0, (Date.now() - ts)) / 1000;
            targetTime = Math.min(targetTime, 36000);
          }

          const local = playbackRef.current;
          const sameTrack = local.track?.id === sanitizedTrack.id;
          const localTime = liveTime() || 0;
          const seekNeeded =
            !sameTrack || Math.abs(localTime - targetTime) > SEEK_TOLERANCE_S;

          if (!sameTrack || seekNeeded || isPlaying !== local.isPlaying) {
            applyRemote({ track: sanitizedTrack, isPlaying: Boolean(isPlaying), currentTime: targetTime });
          }
        })
        .on("presence", { event: "sync" }, () => {
          onPresence(channel.presenceState());
        })
        .on("presence", { event: "join" }, () => {
          onPresence(channel.presenceState());
        })
        .on("presence", { event: "leave" }, () => {
          onPresence(channel.presenceState());
        })
        .subscribe(async (subscribeStatus) => {
          if (subscribeStatus === "SUBSCRIBED") {
            setError(null);
            await channel.track({ user_id: crypto.randomUUID(), name });
            onPresence(channel.presenceState());
          } else if (subscribeStatus === "CHANNEL_ERROR" || subscribeStatus === "TIMED_OUT") {
            setError("Realtime connection failed. Check your connection and try again.");
            setConnecting(false);
          } else if (subscribeStatus === "CLOSED") {
            if (statusRef.current !== "idle") {
              setStatus("idle");
              setMembers([]);
            }
          }
        });
    },
    [applyRemote, name, liveTime]
  );

  const collectMembers = useCallback((presenceState) => {
    const seen = new Set();
    const list = [];
    for (const key of Object.keys(presenceState)) {
      for (const presence of presenceState[key] || []) {
        const id = presence.user_id || `${key}:${presence.name}`;
        if (seen.has(id)) continue;
        seen.add(id);
        list.push({
          id,
          name: presence.name || "Guest",
        });
      }
    }
    setMembers(list);
  }, []);

  const createRoom = useCallback(async () => {
    setError(null);
    await teardown(channelRef);
    const code = generateRoomCode();
    const channel = supabase.channel(`listen-together:${code}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    subscribe(channel, collectMembers);
    setRoomCode(code);
    setStatus("host");
    lastBroadcastRef.current = 0;
    window.setTimeout(() => broadcast(true), 400);
  }, [subscribe, collectMembers, broadcast]);

  const joinRoom = useCallback(
    async (rawCode) => {
      const code = (rawCode || "").trim().toUpperCase();
      if (!code) {
        setError("Enter a room code first.");
        return;
      }
      if (!/^[A-Z0-9]{6}$/.test(code)) {
        setError("Invalid room code format.");
        return;
      }
      setError(null);
      setConnecting(true);
      try {
        await teardown(channelRef);
        const channel = supabase.channel(`listen-together:${code}`, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;
        subscribe(channel, collectMembers);
        setRoomCode(code);
        setStatus("joined");
        lastBroadcastRef.current = 0;
      } finally {
        setConnecting(false);
      }
    },
    [subscribe, collectMembers]
  );

  const leaveRoom = useCallback(() => {
    teardown(channelRef);
    setStatus("idle");
    setRoomCode(null);
    setMembers([]);
  }, []);

  useEffect(() => {
    if (status === "idle") return;
    broadcast(true);
  }, [status, broadcast]);

  useEffect(() => {
    if (status === "idle" || applyingRemoteRef.current) return;
    if (!playback.track) return;
    broadcast();
  }, [playback.track?.id, playback.isPlaying, status, broadcast]);

  useEffect(() => {
    if (status !== "host" || !timeRef) return;
    const id = window.setInterval(() => broadcast(), BROADCAST_DEBOUNCE_MS);
    return () => window.clearInterval(id);
  }, [status, broadcast, timeRef]);

  useEffect(() => {
    return () => {
      teardown(channelRef);
    };
  }, []);

  return {
    status,
    roomCode,
    members,
    error,
    connecting,
    createRoom,
    joinRoom,
    leaveRoom,
  };
}
