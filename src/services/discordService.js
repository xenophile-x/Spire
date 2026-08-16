import { DiscordSDK } from "@discord/embedded-app-sdk";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const READY_TIMEOUT_MS = 6000;

let discordSdk = null;
let currentUser = null;

export function isInDiscordClient() {
  try {
    if (typeof window === "undefined") return false;
    return Boolean(window.parent && window.parent !== window);
  } catch {
    return false;
  }
}

function getSdk() {
  if (!CLIENT_ID) {
    const err = new Error("Missing VITE_DISCORD_CLIENT_ID in .env.local");
    err.code = "NO_CLIENT_ID";
    throw err;
  }
  if (!discordSdk) {
    discordSdk = new DiscordSDK(CLIENT_ID);
  }
  return discordSdk;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const err = new Error(`Timed out ${label}`);
      err.code = "TIMEOUT";
      reject(err);
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function connectDiscord() {
  if (!isInDiscordClient()) {
    const err = new Error("NOT_IN_DISCORD");
    err.code = "NOT_IN_DISCORD";
    throw err;
  }

  const sdk = getSdk();
  await withTimeout(sdk.ready(), READY_TIMEOUT_MS, "connecting to Discord");

  const auth = await withTimeout(
    sdk.commands.authenticate(),
    READY_TIMEOUT_MS,
    "authenticating with Discord"
  );

  currentUser = auth.user;

  try {
    await sdk.commands.setActivity({
      activity: {
        type: 2,
        name: "Spire",
        details: "Listening together",
        state: "Ready to listen together",
        timestamps: { start: Date.now() },
      },
    });
  } catch (err) {
    console.warn("[Discord] Failed to set initial activity:", err);
  }

  return auth.user;
}

export async function setDiscordActivity(track, isPlaying, currentTime = 0) {
  if (!discordSdk) return;
  try {
    await discordSdk.commands.setActivity({
      activity: {
        type: 2,
        name: "Spire",
        details: track?.title || "Nothing playing",
        state: track?.artist
          ? `${track.artist}${isPlaying ? "" : " - Paused"}`
          : isPlaying
            ? "Playing"
            : "Paused",
        timestamps: isPlaying && track ? { start: Date.now() - currentTime * 1000 } : undefined,
      },
    });
  } catch (err) {
    console.warn("[Discord] Failed to update activity:", err);
  }
}

export function getDiscordUser() {
  return currentUser;
}

export function isDiscordConnected() {
  return Boolean(currentUser);
}