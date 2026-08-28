// In-memory token storage (cleared on tab close/refresh)
// More secure than localStorage: not accessible to XSS via localStorage API
let memoryDriveToken = null;
let memoryDriveTokenTimestamp = null;

export function setDriveAccessToken(token) {
  if (token) {
    memoryDriveToken = token;
    memoryDriveTokenTimestamp = Date.now();
  }
}

export function getDriveAccessToken() {
  return memoryDriveToken;
}

export function getDriveTokenTimestamp() {
  return memoryDriveTokenTimestamp;
}

export function clearDriveAccessToken() {
  memoryDriveToken = null;
  memoryDriveTokenTimestamp = null;
}