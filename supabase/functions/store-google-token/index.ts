import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin && origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };

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
    if (
      !body ||
      (typeof body.access_token !== "string" && typeof body.code !== "string")
    ) {
      return new Response(JSON.stringify({ error: "access_token or code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresInSec = typeof body.expires_in === "number" ? body.expires_in : 55 * 60;
    let accessToken = typeof body.access_token === "string" ? body.access_token : null;
    let expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    let refreshToken: string | null = null;
    let scope: string | null = null;
    let tokenType: string | null = null;

    if (body.code) {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return new Response(
          JSON.stringify({ error: "Google OAuth credentials not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(body.code),
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: "postmessage",
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[store-google-token] code exchange failed:", tokenRes.status, errText);
        return new Response(JSON.stringify({ error: "Authorization code exchange failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokens = await tokenRes.json();
      if (!tokens.access_token || typeof tokens.access_token !== "string") {
        console.error("[store-google-token] exchange returned no access_token");
        return new Response(JSON.stringify({ error: "Token exchange returned no access token" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      accessToken = tokens.access_token;
      refreshToken =
        typeof tokens.refresh_token === "string" ? tokens.refresh_token : null;
      scope = typeof tokens.scope === "string" ? tokens.scope : null;
      tokenType = typeof tokens.token_type === "string" ? tokens.token_type : null;
      if (typeof tokens.expires_in === "number") {
        expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      }
    }

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "access_token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: upsertError } = await adminClient
      .from("google_oauth_tokens")
      .upsert(
        {
          user_id: user.id,
          access_token: accessToken,
          ...(refreshToken ? { refresh_token: refreshToken } : {}),
          ...(scope ? { scope } : {}),
          ...(tokenType ? { token_type: tokenType } : {}),
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