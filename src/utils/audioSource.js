import { supabase } from "@/lib/supabaseClient";

const CACHE_LIMIT = 10;
const urlCache = new Map();
const inflight = new Map();

async function resolveTokens() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      googleToken: session?.provider_token || "",
      accessToken: session?.access_token || "",
    };
  } catch {
    return { googleToken: "", accessToken: "" };
  }
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

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL not set");
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (supabaseAnonKey) headers.apikey = supabaseAnonKey;
  const response = await fetch(
    `${supabaseUrl}/functions/v1/stream-track?trackId=${encodeURIComponent(driveId)}`,
    { headers }
  );
  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
  return await response.blob();
}

export async function getAudioObjectUrl(driveId) {
  if (!driveId) throw new Error("Missing Drive file id");

  const cached = urlCache.get(driveId);
  if (cached) {
    urlCache.delete(driveId);
    urlCache.set(driveId, cached);
    return cached;
  }

  const pending = inflight.get(driveId);
  if (pending) return pending;

  const promise = fetchDriveBlob(driveId)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      urlCache.set(driveId, url);
      while (urlCache.size > CACHE_LIMIT) {
        const oldestKey = urlCache.keys().next().value;
        const oldestUrl = urlCache.get(oldestKey);
        urlCache.delete(oldestKey);
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

export function preloadAudio(driveId) {
  if (!driveId || urlCache.has(driveId) || inflight.has(driveId)) return;
  getAudioObjectUrl(driveId).catch(() => {});
}
