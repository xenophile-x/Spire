import { DiscordSDK } from "@discord/embedded-app-sdk";
import { supabase } from "@/lib/supabaseClient";

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

// Method 3: Discord Activity auto-sync
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

  // Link Discord ID to Supabase user for bot access
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && auth.user?.id) {
      await supabase.from('users').update({ discord_id: auth.user.id }).eq('id', user.id);
    }
  } catch (err) {
    console.warn("[Discord] Failed to link Discord ID:", err);
  }

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

// Method 1: Discord OAuth2 linking
export async function connectDiscordOAuth() {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'discord',
    options: {
      redirectTo: `${window.location.origin}/settings`,
    },
  });

  if (error) throw error;
}

// Method 2: One-time linking code redemption
export async function redeemLinkCode(code) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const res = await supabase.functions.invoke("redeem-link-code", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { code },
  });

  if (res.error) throw new Error(res.error.message || "Failed to redeem code");
  return res.data;
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

export async function openExternalLink(url) {
  if (!isInDiscordClient()) return false;
  const sdk = getSdk();
  await withTimeout(sdk.ready(), READY_TIMEOUT_MS, "opening external link");
  await sdk.commands.openExternalLink({ url });
  return true;
}

export function getDiscordUser() {
  return currentUser;
}

export function isDiscordConnected() {
  return Boolean(currentUser);
}
