import { supabase } from "@/lib/supabaseClient";

const CACHE_LIMIT = 10;
const streamUrlCache = new Map();
const blobUrlCache = new Map();
const inflight = new Map();

const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
let tokenCache = { googleToken: "", accessToken: "", expiry: 0 };

async function resolveTokens() {
  const now = Date.now();
  if (tokenCache.expiry > now) {
    return { googleToken: tokenCache.googleToken, accessToken: tokenCache.accessToken };
  }
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const tokens = {
      googleToken: session?.provider_token || "",
      accessToken: session?.access_token || "",
    };
    tokenCache = { ...tokens, expiry: now + TOKEN_CACHE_TTL_MS };
    return tokens;
  } catch {
    return { googleToken: "", accessToken: "" };
  }
}

function getStreamUrl(driveId) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL not set");
  return `${supabaseUrl}/functions/v1/stream-track?trackId=${encodeURIComponent(driveId)}`;
}

async function fetchDriveBlob(driveId) {
  const { googleToken, accessToken } = await resolveTokens();

  if (googleToken) {
    try {
      const directResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      if (directResponse.ok) return await directResponse.blob();
      console.warn(
        `[audioSource] Direct Drive fetch blocked (${directResponse.status}) — falling back to proxy...`
      );
    } catch (err) {
      console.warn("[audioSource] Direct Drive fetch failed:", err);
    }
  }

  const response = await fetch(getStreamUrl(driveId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  return await response.blob();
}

export async function getAudioObjectUrl(driveId) {
  if (!driveId) throw new Error("Missing Drive file id");

  const cached = blobUrlCache.get(driveId);
  if (cached) return cached;

  const pending = inflight.get(driveId);
  if (pending) return pending;

  const promise = fetchDriveBlob(driveId)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      blobUrlCache.set(driveId, url);
      while (blobUrlCache.size > CACHE_LIMIT) {
        const oldestKey = blobUrlCache.keys().next().value;
        const oldestUrl = blobUrlCache.get(oldestKey);
        blobUrlCache.delete(oldestKey);
        URL.revokeObjectURL(oldestUrl);
      }
      return url;
    })
    .finally(() => {
      inflight.delete(driveId);
    });

  inflight.set(driveId, promise);
  return promise;
}

export async function getStreamTrackUrl(driveId) {
  if (!driveId) throw new Error("Missing Drive file id");

  // Audio element GET can't send Authorization header, so embed the
  // Supabase JWT as ?token= — stream-track reads it as fallback.
  const { accessToken } = await resolveTokens();
  const baseUrl = getStreamUrl(driveId);
  const url = accessToken ? `${baseUrl}&token=${encodeURIComponent(accessToken)}` : baseUrl;

  const cacheKey = driveId + (accessToken ? `:${accessToken.slice(-8)}` : "");
  const cached = streamUrlCache.get(cacheKey);
  if (cached) return cached;

  streamUrlCache.set(cacheKey, url);
  // Also keep base key for preload dedupe
  if (!streamUrlCache.has(driveId)) streamUrlCache.set(driveId, url);
  while (streamUrlCache.size > CACHE_LIMIT * 2) {
    const oldestKey = streamUrlCache.keys().next().value;
    streamUrlCache.delete(oldestKey);
  }

  return url;
}

export function preloadAudio(driveId) {
  if (!driveId || streamUrlCache.has(driveId) || inflight.has(driveId)) return;
  getStreamTrackUrl(driveId).catch(() => {});
}

export function preloadAudioRange(driveId, startByte = 0, endByte = 1024 * 1024) {
  if (!driveId) return;
  getStreamTrackUrl(driveId).then((url) => {
    if (!url) return;
    const rangeHeader = `bytes=${startByte}-${endByte}`;
    fetch(url, { method: "HEAD", headers: { Range: rangeHeader } }).catch(() => {});
  }).catch(() => {});
}

export function revokeAllAudioUrls() {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
  streamUrlCache.clear();
}