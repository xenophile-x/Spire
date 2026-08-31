import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";
const ALLOWED_ORIGINS = [
  ALLOWED_ORIGIN,
  "https://spire-wheat-ten.vercel.app",
  "https://spire-hazel.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];
function getCorsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

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

    const { trackId } = await req.json();
    if (!trackId) {
      return new Response(JSON.stringify({ error: "Missing trackId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: track, error: trackErr } = await adminClient
      .from("user_tracks")
      .select("drive_file_id, user_id, track_id")
      .eq("id", trackId)
      .single();

    if (trackErr || !track) {
      return new Response(JSON.stringify({ error: "Track not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (track.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden: Not track owner" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenData, error: tokenErr } = await adminClient
      .from("google_oauth_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: "No OAuth token stored for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenData.access_token;
    const isExpired = new Date(tokenData.expires_at) <= new Date();

    if (isExpired && tokenData.refresh_token) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshRes.json();
      if (!refreshRes.ok) {
        throw new Error(refreshData.error_description || "Failed to refresh Google token");
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

      await adminClient
        .from("google_oauth_tokens")
        .update({
          access_token: accessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }

    if (track.drive_file_id) {
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${track.drive_file_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!driveRes.ok && driveRes.status !== 404) {
        const driveErr = await driveRes.json();
        console.error("Google Drive API Error:", driveErr);

      }
    }

    const { error: deleteDbErr } = await adminClient
      .from("user_tracks")
      .delete()
      .eq("id", trackId);

    if (deleteDbErr) throw deleteDbErr;

    if (track.track_id) {
      const countRefs = async (table: string) => {
        const { count, error } = await adminClient
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("track_id", track.track_id);
        if (error) throw error;
        return count ?? 0;
      };

      try {
        const [remainingLibrary, likes, history] = await Promise.all([
          countRefs("user_tracks"),
          countRefs("liked_songs"),
          countRefs("listening_history"),
        ]);

        if (remainingLibrary === 0 && likes === 0 && history === 0) {
          const { error: deleteCanonicalErr } = await adminClient
            .from("tracks")
            .delete()
            .eq("id", track.track_id);
          if (deleteCanonicalErr) {

            console.error("Failed to delete orphaned canonical track:", deleteCanonicalErr);
          }
        }
      } catch (orphanErr) {
        console.error("Orphan check failed:", orphanErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error in delete-track:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});