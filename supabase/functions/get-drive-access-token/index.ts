import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_SECRET = Deno.env.get("BOT_SECRET") ?? Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bot-secret",
  "Vary": "Origin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Bot auth: require both service_role AND x-bot-secret (defense in depth, prevents key-only replay)
    const authHeader = req.headers.get("Authorization");
    const botSecret = req.headers.get("x-bot-secret");
    const validAuth = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    const validSecret = BOT_SECRET && botSecret === BOT_SECRET;
    // Allow either check to pass during rollout, but log if only one
    if (!validAuth && !validSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!validSecret && validAuth) {
      console.warn("[get-drive-access-token] missing x-bot-secret — update bot env BOT_SECRET");
    }

    const body = await req.json().catch(() => null);
    const discordIdRaw = body?.discord_id?.toString().trim();
    if (!discordIdRaw || !/^\d{17,20}$/.test(discordIdRaw)) {
      return new Response(JSON.stringify({ error: "Invalid discord_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const discordId = discordIdRaw;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: user, error: userError } = await adminClient.from("users").select("id").eq("discord_id", discordId).maybeSingle();
    if (userError || !user) {
      // Generic error to prevent enumeration (don't reveal linked vs not)
      return new Response(JSON.stringify({ error: "Account not linked or Drive not connected. Link in Spire settings." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tokenRow, error: tokenError } = await adminClient.from("google_oauth_tokens").select("refresh_token, access_token, expires_at").eq("user_id", user.id).maybeSingle();
    if (tokenError || !tokenRow?.refresh_token) {
      return new Response(JSON.stringify({ error: "Account not linked or Drive not connected. Link in Spire settings." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const expiresAt = new Date(tokenRow.expires_at).getTime();
    // Fix: refresh proactively if token expires within 5 min (300s) instead of 60s
    // Google access_token is 3600s; refreshing within 3600s means we catch expiry during long playback
    // Use 5 min buffer to avoid 3600s edge where stream starts valid but expires mid-stream
    const REFRESH_BUFFER_MS = 5 * 60 * 1000;
    if (tokenRow.access_token && Number.isFinite(expiresAt) && Date.now() < expiresAt - REFRESH_BUFFER_MS) {
      return new Response(JSON.stringify({ access_token: tokenRow.access_token }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // If expires_at is null/invalid or within buffer, force refresh (also handles clock skew)

    const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokenRow.refresh_token, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET }),
    });
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Google token refresh failed:", errBody);
      return new Response(JSON.stringify({ error: "Drive authorization expired. Reconnect in Spire settings." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const tokenData = await tokenRes.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    await adminClient.from("google_oauth_tokens").update({ access_token: tokenData.access_token, expires_at: newExpiresAt, ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}) }).eq("user_id", user.id);
    return new Response(JSON.stringify({ access_token: tokenData.access_token }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error in get-drive-access-token:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
