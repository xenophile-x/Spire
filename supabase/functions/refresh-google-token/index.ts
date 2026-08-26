
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tokenRow, error: fetchError } = await adminClient
      .from("google_oauth_tokens")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !tokenRow?.refresh_token) {
      return new Response(
        JSON.stringify({ error: "No refresh token on file. Full re-authentication required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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

      if (tokenRes.status === 400 || tokenRes.status === 401) {
        await adminClient
          .from("google_oauth_tokens")
          .update({ refresh_token: null })
          .eq("user_id", user.id);
      }

      return new Response(
        JSON.stringify({ error: "Google refresh failed. Full re-authentication required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { error: updateError } = await adminClient
      .from("google_oauth_tokens")
      .update({
        access_token: tokenData.access_token,
        expires_at: expiresAt,
        scope: tokenData.scope ?? undefined,
        token_type: tokenData.token_type ?? "Bearer",
        ...(tokenData.refresh_token ? { refresh_token: tokenData.refresh_token } : {}),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to persist refreshed token:", updateError);
    }

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        expires_at: expiresAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in refresh-google-token:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});