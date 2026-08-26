import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify service role key (bot auth)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const discordId = body?.discord_id;
    if (!discordId) {
      return new Response(JSON.stringify({ error: "discord_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up Supabase user by discord_id
    const { data: user, error: userError } = await adminClient
      .from("users")
      .select("id")
      .eq("discord_id", discordId)
      .maybeSingle();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not linked" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get stored tokens
    const { data: tokenRow, error: tokenError } = await adminClient
      .from("google_oauth_tokens")
      .select("refresh_token, access_token, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tokenError || !tokenRow?.refresh_token) {
      return new Response(JSON.stringify({ error: "No Google Drive connection" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if access_token still valid
    const expiresAt = new Date(tokenRow.expires_at).getTime();
    if (tokenRow.access_token && Date.now() < expiresAt - 60_000) {
      return new Response(JSON.stringify({ access_token: tokenRow.access_token }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh token
    const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRow.refresh_token,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Google token refresh failed:", errBody);
      return new Response(JSON.stringify({ error: "Token refresh failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenRes.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Persist new tokens
    await adminClient
      .from("google_oauth_tokens")
      .update({
        access_token: tokenData.access_token,
        expires_at: newExpiresAt,
        ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
      })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ access_token: tokenData.access_token }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in get-drive-access-token:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});