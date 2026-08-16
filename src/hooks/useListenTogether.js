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

export function useListenTogether({
  name = "Guest",
  playback = { track: null, isPlaying: false, currentTime: 0 },
  onRemoteState = () => {},
}) {
  const [status, setStatus] = useState("idle"); // idle | host | joined
  const [roomCode, setRoomCode] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const channelRef = useRef(null);
  const applyingRemoteRef = useRef(false);
  const lastBroadcastRef = useRef(0);
  const playbackRef = useRef(playback);
  const onRemoteStateRef = useRef(onRemoteState);

  playbackRef.current = playback;
  onRemoteStateRef.current = onRemoteState;

  const applyRemote = useCallback((state) => {
    applyingRemoteRef.current = true;
    onRemoteStateRef.current(state);
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 600);
  }, []);

  const broadcast = useCallback(
    (force = false) => {
      const channel = channelRef.current;
      const { track, isPlaying, currentTime } = playbackRef.current;
      if (!channel || !track) return;
      if (applyingRemoteRef.current) return;

      const now = Date.now();
      if (!force && now - lastBroadcastRef.current < BROADCAST_DEBOUNCE_MS) return;
      lastBroadcastRef.current = now;

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
          currentTime: Number(currentTime) || 0,
          ts: now,
          name,
        },
      });
    },
    [name]
  );

  const subscribe = useCallback(
    (channel, onPresence) => {
      channel
        .on("broadcast", { event: "listen-state" }, ({ payload }) => {
          if (!payload?.track?.id) return;
          const { track, isPlaying, currentTime, ts } = payload;
          const local = playbackRef.current;

          let targetTime = Number(currentTime) || 0;
          if (isPlaying && local.track?.id === track.id && ts) {
            targetTime += (Date.now() - ts) / 1000;
          }

          const sameTrack = local.track?.id === track.id;
          const seekNeeded =
            !sameTrack || Math.abs((local.currentTime || 0) - targetTime) > SEEK_TOLERANCE_S;

          if (!sameTrack || seekNeeded || isPlaying !== local.isPlaying) {
            applyRemote({ track, isPlaying, currentTime: targetTime });
          }
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          onPresence(state);
        })
        .on("presence", { event: "join" }, () => {
          onPresence(channel.presenceState());
        })
        .on("presence", { event: "leave" }, () => {
          onPresence(channel.presenceState());
        })
        .subscribe(async (subscribeStatus) => {
          if (subscribeStatus !== "SUBSCRIBED") return;
          await channel.track({ user_id: crypto.randomUUID(), name });
          onPresence(channel.presenceState());
        });
    },
    [applyRemote, name]
  );

  const collectMembers = useCallback((presenceState) => {
    const list = [];
    for (const key of Object.keys(presenceState)) {
      for (const presence of presenceState[key] || []) {
        list.push({
          id: presence.user_id,
          name: presence.name || "Guest",
        });
      }
    }
    setMembers(list);
  }, []);

  const createRoom = useCallback(async () => {
    setError(null);
    const code = generateRoomCode();
    const channel = supabase.channel(`listen-together:${code}`, {
      config: { broadcast: { self: false }, presence: { key: "members" } },
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
      setError(null);
      setConnecting(true);
      try {
        const channel = supabase.channel(`listen-together:${code}`, {
          config: { broadcast: { self: false }, presence: { key: "members" } },
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
    const channel = channelRef.current;
    if (channel) {
      channel.untrack().then(() => channel.unsubscribe());
    }
    channelRef.current = null;
    setStatus("idle");
    setRoomCode(null);
    setMembers([]);
  }, []);

  useEffect(() => {
    if (status === "idle") return;
    const { track } = playbackRef.current;
    const force = !track;
    const id = window.setTimeout(() => broadcast(force), 300);
    return () => window.clearTimeout(id);
  }, [status, broadcast]);

  useEffect(() => {
    if (status === "idle" || applyingRemoteRef.current) return;
    const { track } = playbackRef.current;
    if (!track) return;
    broadcast();
  }, [playback.track?.id, playback.isPlaying, playback.currentTime, status, broadcast]);

  useEffect(() => {
    return () => {
      const channel = channelRef.current;
      if (channel) {
        channel.untrack().then(() => channel.unsubscribe());
      }
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