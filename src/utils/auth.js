const STORAGE_KEY = "spire:drive:token";
const TIMESTAMP_KEY = "spire:drive:timestamp";

let memoryDriveToken = null;
let memoryDriveTokenTimestamp = null;

function initFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedTs = localStorage.getItem(TIMESTAMP_KEY);
    if (stored) {
      memoryDriveToken = stored;
      memoryDriveTokenTimestamp = storedTs ? Number(storedTs) : null;
    }
  } catch {}
}

initFromStorage();

export function setDriveAccessToken(token) {
  if (token) {
    memoryDriveToken = token;
    memoryDriveTokenTimestamp = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, token);
      localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
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
  } catch {}
}