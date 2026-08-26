import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const body = await req.json().catch(() => null);
    if (!body?.access_token || typeof body.access_token !== "string") {
      return new Response(JSON.stringify({ error: "access_token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep parity with the previous client-side TTLs:
    // access token ~55 min, session window 30 days (see one_month_token_ttl migration).
    const expiresInSec = typeof body.expires_in === "number" ? body.expires_in : 55 * 60;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: upsertError } = await adminClient
      .from("google_oauth_tokens")
      .upsert(
        {
          user_id: user.id,
          access_token: body.access_token,
          ...(body.refresh_token ? { refresh_token: body.refresh_token } : {}),
          expires_at: expiresAt,
          session_expires_at: sessionExpiresAt,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("[store-google-token] upsert failed:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to store token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[store-google-token] unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
