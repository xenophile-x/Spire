import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173";

const attempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const rec = attempts.get(userId);
  if (!rec || now > rec.resetAt) {
    attempts.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (rec.count >= 5) return false;
  rec.count++;
  return true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin && origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const rawCode = body?.code;
    if (!rawCode || typeof rawCode !== "string" || !/^\d{6}$/.test(rawCode.trim())) {
      return new Response(JSON.stringify({ error: "Invalid code format. Must be 6 digits." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const code = rawCode.trim();

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: "Too many attempts. Try again in a minute." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: me } = await admin.from("users").select("discord_id").eq("id", user.id).maybeSingle();
    if (me?.discord_id) {
      return new Response(JSON.stringify({ error: "Already linked to Discord. Unlink first to change." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Performance: single SELECT to validate code & get discord_id before consuming, to preserve code on 409
    const { data: candidate, error: selErr } = await admin.from("linking_codes").select("id, discord_id, expires_at").eq("code", code).maybeSingle();
    if (selErr || !candidate) {
      return new Response(JSON.stringify({ error: "Invalid or expired linking code." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(candidate.expires_at).getTime() <= Date.now()) {
      await admin.from("linking_codes").delete().eq("id", candidate.id);
      return new Response(JSON.stringify({ error: "Invalid or expired linking code." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: existing } = await admin.from("users").select("id").eq("discord_id", candidate.discord_id).maybeSingle();
    if (existing && existing.id !== user.id) {
      return new Response(JSON.stringify({ error: "This Discord account is already linked to a different user." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Atomic consume: DELETE where id matches & not expired (TOCTOU-safe; only one winner)
    const { data: deleted, error: delErr } = await admin.from("linking_codes").delete().eq("id", candidate.id).gt("expires_at", new Date().toISOString()).select("discord_id").maybeSingle();
    if (delErr || !deleted) {
      return new Response(JSON.stringify({ error: "Invalid or expired linking code." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: updErr } = await admin.from("users").update({ discord_id: deleted.discord_id, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (updErr) {
      if ((updErr as { code?: string }).code === "23505") {
        return new Response(JSON.stringify({ error: "Discord account already linked elsewhere" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Failed to update user profile." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("linking_codes").delete().eq("discord_id", deleted.discord_id);

    return new Response(JSON.stringify({ success: true, discord_id: deleted.discord_id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});