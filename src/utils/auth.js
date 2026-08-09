const DRIVE_TOKEN_KEY = "spire_drive_access_token";
const DRIVE_TOKEN_TIMESTAMP_KEY = "spire_drive_access_token_issued_at";

export function setDriveAccessToken(token) {
  if (token) {
    localStorage.setItem(DRIVE_TOKEN_KEY, token);
    localStorage.setItem(DRIVE_TOKEN_TIMESTAMP_KEY, String(Date.now()));
  }
}

export function getDriveAccessToken() {
  return localStorage.getItem(DRIVE_TOKEN_KEY);
}

export function getDriveTokenTimestamp() {
  const raw = localStorage.getItem(DRIVE_TOKEN_TIMESTAMP_KEY);
  return raw ? Number(raw) : null;
}

export function clearDriveAccessToken() {
  localStorage.removeItem(DRIVE_TOKEN_KEY);
  localStorage.removeItem(DRIVE_TOKEN_TIMESTAMP_KEY);
}