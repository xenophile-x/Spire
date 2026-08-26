import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

type TokenRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

async function refreshOwnerToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
  tokenRow: TokenRow
): Promise<string | null> {
  if (!tokenRow.refresh_token) return null;

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("Google OAuth client credentials not configured");
    return null;
  }

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Google refresh failed:", res.status, errText);
    return null;
  }

  const data = await res.json();
  const newAccessToken: string | undefined = data.access_token;
  if (!newAccessToken) return null;

  const expiresIn: number = typeof data.expires_in === "number" ? data.expires_in : 3600;
  const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  await admin
    .from("google_oauth_tokens")
    .update({
      access_token: newAccessToken,
      expires_at: newExpiry,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return newAccessToken;
}

function isTokenExpired(tokenRow: TokenRow): boolean {
  if (!tokenRow.expires_at) return true;
  const expiresAtMs = new Date(tokenRow.expires_at).getTime();
  return Date.now() >= expiresAtMs - 60_000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const trackId = url.searchParams.get("trackId");
    const shareToken = url.searchParams.get("shareToken");

    if (!trackId) {
      return new Response("trackId parameter required", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let requester: { id: string; email: string | null } | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader && !authHeader.startsWith("Bearer sb_")) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data } = await supabaseAuth.auth.getUser();
      if (data?.user) {
        requester = {
          id: data.user.id,
          email: data.user.email ?? null,
        };
      }
    }

    let track: { drive_file_id: string; user_id: string } | null = null;

    const byId = await supabaseAdmin
      .from("user_tracks")
      .select("drive_file_id, user_id")
      .eq("id", trackId)
      .maybeSingle();

    if (byId.data) {
      track = byId.data;
    } else {
      const byDriveFile = await supabaseAdmin
        .from("user_tracks")
        .select("drive_file_id, user_id")
        .eq("drive_file_id", trackId)
        .maybeSingle();
      track = byDriveFile.data ?? null;
    }

    if (!track) {
      return new Response("Track not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    const isOwner = requester && requester.id === track.user_id;
    let authorized = Boolean(isOwner);

    if (!authorized && shareToken) {
      const { data: ownerProfile } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", track.user_id)
        .eq("share_token", shareToken)
        .eq("is_library_public", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (ownerProfile) {
        authorized = true;
      }
    }

    if (!authorized && requester?.email) {
      const { data: share } = await supabaseAdmin
        .from("library_shares")
        .select("id")
        .eq("owner_id", track.user_id)
        .eq("grantee_email", requester.email.toLowerCase())
        .eq("status", "accepted")
        .maybeSingle();
      if (share) {
        authorized = true;
      }
    }

    if (!authorized) {
      return new Response("Forbidden", {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { data: tokenData } = await supabaseAdmin
      .from("google_oauth_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", track.user_id)
      .maybeSingle();

    if (!tokenData?.access_token) {
      console.error("No access token for user:", track.user_id);
      return new Response("No Drive token available", {
        status: 401,
        headers: corsHeaders,
      });
    }

    let accessToken = tokenData.access_token;

    if (isTokenExpired(tokenData as TokenRow)) {
      const refreshed = await refreshOwnerToken(supabaseAdmin, track.user_id, tokenData as TokenRow);
      if (refreshed) {
        accessToken = refreshed;
      } else {
        return new Response("Owner's Google connection needs re-authentication", {
          status: 403,
          headers: corsHeaders,
        });
      }
    }

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${track.drive_file_id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (driveRes.status === 401 || driveRes.status === 403) {
      const refreshed = await refreshOwnerToken(supabaseAdmin, track.user_id, tokenData as TokenRow);
      if (refreshed) {
        const retryRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${track.drive_file_id}?alt=media`,
          {
            headers: { Authorization: `Bearer ${refreshed}` },
          }
        );
        if (retryRes.ok) {
          return streamResponse(retryRes);
        }
        const retryErr = await retryRes.text();
        console.error("Drive retry failed:", retryRes.status, retryErr);
        return new Response(`Drive API error: ${retryRes.status}`, {
          status: retryRes.status,
          headers: corsHeaders,
        });
      }
      const errText = await driveRes.text();
      console.error("Drive API error and refresh unavailable:", driveRes.status, errText);
      return new Response(`Drive API error: ${driveRes.status}`, {
        status: driveRes.status,
        headers: corsHeaders,
      });
    }

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      console.error("Drive API error:", driveRes.status, errText);
      return new Response(`Drive API error: ${driveRes.status}`, {
        status: driveRes.status,
        headers: corsHeaders,
      });
    }

    return streamResponse(driveRes);
  } catch (err) {
    console.error("Unexpected error in stream-track:", err);
    return new Response("Internal server error", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});

function streamResponse(driveRes: Response): Response {
  const contentType = driveRes.headers.get("content-type") || "audio/mpeg";
  return new Response(driveRes.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
