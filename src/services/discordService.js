import { DiscordSDK } from "@discord/embedded-app-sdk";
import { supabase } from "@/lib/supabaseClient";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const READY_TIMEOUT_MS = 8000;

let discordSdk = null;
let currentUser = null;

export function isInDiscordClient() {
  try {
    if (typeof window === "undefined") return false;
    const isIframe = Boolean(window.parent && window.parent !== window);
    const hasDiscordEnv = Boolean(
      window.location.search.includes("frame_id") ||
      window.location.search.includes("instance_id") ||
      window.discordSdk ||
      window.DiscordSDK
    );
    if (hasDiscordEnv) return true;
    return isIframe && Boolean(CLIENT_ID);
  } catch { return false; }
}

function getSdk() {
  if (!CLIENT_ID) throw Object.assign(new Error("Missing VITE_DISCORD_CLIENT_ID"), { code: "NO_CLIENT_ID" });
  if (!discordSdk) discordSdk = new DiscordSDK(CLIENT_ID);
  return discordSdk;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error(`Timed out ${label}`), { code: "TIMEOUT" })), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

export async function connectDiscord() {
  if (!isInDiscordClient()) throw Object.assign(new Error("NOT_IN_DISCORD"), { code: "NOT_IN_DISCORD" });
  
  const sdk = getSdk();
  await withTimeout(sdk.ready(), READY_TIMEOUT_MS, "connecting to Discord");

  // Step 1: Authorize to get OAuth2 code (required for Discord Activities)
  const { code } = await withTimeout(
    sdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "rpc.activities.write"],
    }),
    READY_TIMEOUT_MS,
    "authorizing with Discord"
  );

  // Step 2: Exchange code for access token via backend (keeps client secret safe)
  const tokenResponse = await withTimeout(
    fetch("/.proxy/api/supabase/functions/v1/discord-token-exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }),
    READY_TIMEOUT_MS,
    "exchanging Discord token"
  );
  if (!tokenResponse.ok) {
    const err = await tokenResponse.json().catch(() => ({ error: "Token exchange failed" }));
    throw new Error(err.error || `Token exchange failed: ${tokenResponse.status}`);
  }
  const { access_token } = await tokenResponse.json();

  // Step 3: Authenticate SDK with the access token
  const auth = await withTimeout(
    sdk.commands.authenticate({ access_token }),
    READY_TIMEOUT_MS,
    "authenticating with Discord"
  );

  currentUser = auth.user;

  // Step 4: Link Discord ID to Supabase user (server-verified)
  if (auth.user?.id) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const { error } = await supabase.functions.invoke("link-discord", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { discord_id: auth.user.id },
        });
        if (!error) {
          const { data: { user: supabaseUser } } = await supabase.auth.getUser();
          if (supabaseUser) {
            const { data: tokenRow } = await supabase
              .from("google_oauth_tokens").select("refresh_token").eq("user_id", supabaseUser.id).maybeSingle();
            if (!tokenRow?.refresh_token) return { ...auth.user, needsOfflineDriveAccess: true };
          }
        } else console.warn("[Discord] link-discord failed:", error.message);
      } else console.warn("[Discord] No Supabase session");
    } catch (err) { console.warn("[Discord] Failed to link:", err); }
  }

  try {
    await sdk.commands.setActivity({
      activity: { type: 2, name: "Spire", details: "Listening together", state: "Ready to listen together", timestamps: { start: Date.now() } },
    });
  } catch (err) { console.warn("[Discord] Failed to set activity:", err); }

  return auth.user;
}

// Method 1: Discord OAuth2 linking (web only — disabled in Discord client)
export async function connectDiscordOAuth() {
  if (isInDiscordClient()) throw Object.assign(new Error("OAuth not supported in Discord client"), { code: "NOT_IN_DISCORD" });
  const { error } = await supabase.auth.linkIdentity({
    provider: 'discord',
    options: { redirectTo: `${window.location.origin}/settings` },
  });
  if (error) throw error;
}

// Method 2: One-time linking code redemption (atomic server-side)
export async function redeemLinkCode(code) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated — sign in with Google first");
  const normalized = String(code).trim().toUpperCase();
  const res = await supabase.functions.invoke("redeem-link-code", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { code: normalized },
  });
  // Supabase wraps non-2xx as res.error with message "Edge Function returned a non-2xx status code"
  // — surface the JSON error from the function instead.
  if (res.error) {
    let funcError = res.data?.error || res.error?.context?.json?.error || "";
    if (!funcError && res.error?.context?.body) {
      const body = res.error.context.body;
      funcError = body instanceof ReadableStream
        ? await new Response(body).text()
        : String(body);
    }
    let parsed = funcError || "";
    if (typeof parsed === "string" && parsed.startsWith("{")) {
      try { parsed = JSON.parse(parsed).error || parsed; } catch {}
    }
    throw new Error(parsed || res.data?.error || res.error.message || "Failed to redeem code");
  }
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export async function unlinkDiscord() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  const res = await supabase.functions.invoke("unlink-discord", { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (res.error) throw new Error(res.data?.error || res.error.message || "Failed to unlink");
  currentUser = null; return res.data;
}

export async function fetchLinkedDiscordId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("discord_id").eq("id", user.id).maybeSingle();
  return data?.discord_id || null;
}

export async function setDiscordActivity(track, isPlaying, currentTime = 0) {
  if (!discordSdk) return;
  try {
    await discordSdk.commands.setActivity({
      activity: { type: 2, name: "Spire", details: track?.title || "Nothing playing", state: track?.artist ? `${track.artist}${isPlaying ? "" : " - Paused"}` : isPlaying ? "Playing" : "Paused", timestamps: isPlaying && track ? { start: Date.now() - currentTime * 1000 } : undefined },
    });
  } catch (err) { console.warn("[Discord] Failed to update activity:", err); }
}

export async function openExternalLink(url) {
  if (!isInDiscordClient()) return false;
  const sdk = getSdk();
  await withTimeout(sdk.ready(), READY_TIMEOUT_MS, "opening external link");
  await sdk.commands.openExternalLink({ url }); return true;
}

export function getDiscordUser() { return currentUser; }
export function isDiscordConnected() { return Boolean(currentUser); }