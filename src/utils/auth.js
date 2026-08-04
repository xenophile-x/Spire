// src/utils/auth.js

const DRIVE_TOKEN_KEY = "spire_drive_access_token";

/**
 * Saves Google OAuth access token to local storage.
 */
export function setDriveAccessToken(token) {
  if (token) {
    localStorage.setItem(DRIVE_TOKEN_KEY, token);
  }
}

/**
 * Retrieves the stored Google Drive access token.
 */
export function getDriveAccessToken() {
  return localStorage.getItem(DRIVE_TOKEN_KEY);
}

/**
 * Clears stored OAuth tokens on sign-out.
 */
export function clearDriveAccessToken() {
  localStorage.removeItem(DRIVE_TOKEN_KEY);
}