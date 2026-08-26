import { supabase } from "@/lib/supabaseClient";
import {
  getDriveAccessToken,
  setDriveAccessToken,
  getDriveTokenTimestamp,
} from "./auth";
import { getGoogleAccessToken } from "@/lib/googleTokenClient";

const TOKEN_MAX_AGE_MS = 50 * 60 * 1000;


export async function refreshDriveAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const { data, error } = await supabase.functions.invoke("refresh-google-token", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!error && data?.access_token) {
    setDriveAccessToken(data.access_token);
    return data.access_token;
  }

  // Supabase's managed Google OAuth never gives us a provider refresh token,
  // so server-side refresh fails after the first hour. Fall back to silently
  // minting a fresh short-lived token in-browser (works while the tab is open
  // and the user's Google session persists), and mirror it server-side so
  // stream-track keeps serving shared libraries.
  console.warn("[Drive] Server-side refresh failed:", error?.message || data?.error);

  try {
    const token = await getGoogleAccessToken();
    setDriveAccessToken(token);

    supabase.functions
      .invoke("store-google-token", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { access_token: token, expires_in: 55 * 60 },
      })
      .catch((err) => console.warn("[Drive] Failed to persist refreshed token:", err));

    return token;
  } catch (err) {
    console.warn("[Drive] Browser-side Google token mint failed:", err);
    return null;
  }
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