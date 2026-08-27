import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

// POST { discord_id, discord_username?, avatar? }  - links current authenticated user to discord_id
// Verifies: user is authenticated via Bearer token; discord_id is snowflake; discord_id not already taken
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => null);
    const discordId = body?.discord_id?.toString().trim();
    if (!discordId || !/^\d{17,20}$/.test(discordId)) {
      return new Response(JSON.stringify({ error: "Invalid discord_id (expect 17-20 digit snowflake)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if discord_id already linked to another user
    const { data: existing } = await admin.from("users").select("id").eq("discord_id", discordId).maybeSingle();
    if (existing && existing.id !== user.id) {
      return new Response(JSON.stringify({ error: "Discord account already linked to another user" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if current user already linked to different discord_id (require unlink first)
    const { data: me } = await admin.from("users").select("discord_id").eq("id", user.id).maybeSingle();
    if (me?.discord_id && me.discord_id !== discordId) {
      return new Response(JSON.stringify({ error: "Already linked to a different Discord account. Unlink first." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: updateError } = await admin.from("users").update({ discord_id: discordId, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (updateError) {
      console.error("[link-discord] update failed", updateError);
      return new Response(JSON.stringify({ error: "Failed to link" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cleanup any linking_codes for this discord_id (consumed or stale)
    await admin.from("linking_codes").delete().eq("discord_id", discordId);

    return new Response(JSON.stringify({ success: true, discord_id: discordId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("link-discord error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
