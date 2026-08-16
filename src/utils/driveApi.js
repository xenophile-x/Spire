import { supabase } from "@/lib/supabaseClient";
import {
  getDriveAccessToken,
  setDriveAccessToken,
  getDriveTokenTimestamp,
} from "./auth";

const TOKEN_MAX_AGE_MS = 50 * 60 * 1000; // refresh a bit before the real ~1hr expiry

// Calls the refresh-google-token Edge Function, which exchanges the stored
// refresh_token (server-side) for a genuinely new Google access_token.
export async function refreshDriveAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const { data, error } = await supabase.functions.invoke("refresh-google-token", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || !data?.access_token) {
    console.warn("[Drive] Refresh failed:", error?.message || data?.error);
    return null;
  }

  setDriveAccessToken(data.access_token);
  return data.access_token;
}

function isTokenStale() {
  const issuedAt = getDriveTokenTimestamp();
  return !issuedAt || Date.now() - issuedAt > TOKEN_MAX_AGE_MS;
}

export async function getValidDriveToken() {
  let token = getDriveAccessToken();
  if (!token || isTokenStale()) {
    token = (await refreshDriveAccessToken()) || token;
  }
  return token;
}

export const fetchDriveApi = async (endpoint, options = {}, isRetry = false) => {
  const token = await getValidDriveToken();
  if (!token) throw new Error("Google OAuth token missing or expired.");

  const response = await fetch(`https://www.googleapis.com${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });

  // Belt-and-suspenders: even if our staleness check missed it, retry once on a real 401
  if (response.status === 401 && !isRetry) {
    const newToken = await refreshDriveAccessToken();
    if (newToken) return fetchDriveApi(endpoint, options, true);
    throw new Error("UNAUTHORIZED");
  }

  if (response.status === 401) throw new Error("UNAUTHORIZED");
  return response;
};

export const getOrCreateSpireFolder = async (folderName = "SPIRE") => {
  const query = encodeURIComponent(
    `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );

  const searchResponse = await fetchDriveApi(`/drive/v3/files?q=${query}&fields=files(id,name)`);
  if (!searchResponse.ok) {
    throw new Error("Failed to query Google Drive folders.");
  }

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createResponse = await fetchDriveApi("/drive/v3/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createResponse.ok) {
    throw new Error("Failed to create folder in Google Drive.");
  }

  const newFolder = await createResponse.json();
  return newFolder.id;
};

export const fetchAudioBlobUrl = async (fileId) => {
  const response = await fetchDriveApi(`/drive/v3/files/${fileId}?alt=media`);
  if (!response.ok) {
    throw new Error("Failed to stream audio binary from Google Drive.");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};