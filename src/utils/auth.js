const STORAGE_KEY = "spire:drive:token";
const TIMESTAMP_KEY = "spire:drive:timestamp";

let memoryDriveToken = null;
let memoryDriveTokenTimestamp = null;

function initFromStorage() {
  try {
    // Prefer sessionStorage (cleared on tab close) to limit XSS window
    let stored = null;
    let storedTs = null;
    try {
      stored = window.sessionStorage.getItem(STORAGE_KEY);
      storedTs = window.sessionStorage.getItem(TIMESTAMP_KEY);
    } catch {}
    if (!stored) {
      stored = localStorage.getItem(STORAGE_KEY);
      storedTs = localStorage.getItem(TIMESTAMP_KEY);
      // Migrate to sessionStorage if found in localStorage
      if (stored) {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, stored);
          if (storedTs) window.sessionStorage.setItem(TIMESTAMP_KEY, storedTs);
        } catch {}
      }
    }
    if (stored) {
      memoryDriveToken = stored;
      memoryDriveTokenTimestamp = storedTs ? Number(storedTs) : null;
    }
  } catch {}
}

initFromStorage();

export function setDriveAccessToken(token) {
  if (token) {
    // Minimal exposure: keep in memory, persist only if needed for reload.
    // Token is short-lived (50 min) and never logged. Prefer sessionStorage if available
    // to avoid persistence across tabs, but fallback to localStorage for compat.
    memoryDriveToken = token;
    memoryDriveTokenTimestamp = Date.now();
    try {
      const storage = window.sessionStorage || window.localStorage;
      storage.setItem(STORAGE_KEY, token);
      storage.setItem(TIMESTAMP_KEY, String(Date.now()));
      // Clear the other storage to avoid duplication
      try {
        if (storage === window.sessionStorage) {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(TIMESTAMP_KEY);
        }
      } catch {}
    } catch {}
  }
}

export function getDriveAccessToken() {
  if (!memoryDriveToken) return null;
  if (memoryDriveTokenTimestamp && Date.now() - memoryDriveTokenTimestamp > 50 * 60 * 1000) {
    return null;
  }
  return memoryDriveToken;
}

export function getDriveTokenTimestamp() {
  return memoryDriveTokenTimestamp;
}

export function clearDriveAccessToken() {
  memoryDriveToken = null;
  memoryDriveTokenTimestamp = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TIMESTAMP_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TIMESTAMP_KEY);
  } catch {}
}