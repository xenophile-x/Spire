import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * DiscordLink — Vite + React adaptation
 *
 * SECURE VERSION: uses Supabase Edge Function `redeem-link-code` (service_role)
 * instead of direct table access. This is the correct approach for this codebase.
 *
 * Why not direct client table access?
 * - Migration 20260828000000_fix_discord_security_ato.sql explicitly REVOKEs
 *   all access to linking_codes from anon/authenticated and blocks direct
 *   discord_id updates via RLS + trigger `prevent_client_discord_id_update`.
 * - Direct SELECT/UPDATE/DELETE from the browser would require re-opening
 *   those policies (USING true), re-introducing account-takeover vectors
 *   and race conditions (TOCTOU on expiry).
 * - Edge Functions enforce: rate-limiting (5/min), atomic consume
 *   (DELETE ... WHERE expires_at > now()), single-owner checks, and
 *   service_role-only writes — none of which RLS alone can guarantee.
 *
 * If you truly need pure client-side (no Edge Functions), see the
 * insecure alternative commented at the bottom — but DO NOT deploy the
 * RLS policies suggested in the prompt without understanding the tradeoff.
 */
export default function DiscordLink({ userId, onLinked }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  const handleLink = async (e) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,8}$/.test(normalized)) {
      setStatus("error");
      setMessage("Code must be 6-8 alphanumeric characters (e.g. 57F2D895).");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      // ✅ Secure: let Edge Function validate expiry, atomicity, ownership
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated. Please sign in first.");
      }

      const { data, error } = await supabase.functions.invoke("redeem-link-code", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { code: normalized },
      });

      if (error) {
        // supabase-js wraps Edge Function errors; prefer data.error if present
        throw new Error(data?.error || error.message || "Failed to redeem code");
      }
      if (data?.error) throw new Error(data.error);

      setStatus("success");
      setMessage("Discord account successfully linked! You can now use /play in Discord.");
      setCode("");
      onLinked?.(data?.discord_id ?? null);
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Something went wrong.");
    }
  };

  // Insecure direct-client alternative (NOT RECOMMENDED — requires weakening RLS):
  // const handleLinkInsecure = async (e) => {
  //   e.preventDefault();
  //   const { data: linkData, error: linkError } = await supabase.from("linking_codes").select("*").eq("code", code).single();
  //   if (linkError || !linkData) throw new Error("Invalid code.");
  //   if (new Date(linkData.expires_at) < new Date()) {
  //     await supabase.from("linking_codes").delete().eq("code", code);
  //     throw new Error("Expired.");
  //   }
  //   const { error: updateError } = await supabase.from("users").update({ discord_id: linkData.discord_id }).eq("id", userId);
  //   if (updateError) throw new Error("Failed to link.");
  //   await supabase.from("linking_codes").delete().eq("code", code);
  // };

  return (
    <div className="p-6 max-w-md mx-auto bg-gray-900 rounded-xl shadow-md border border-gray-800 text-white">
      <h2 className="text-xl font-bold mb-2">Connect Discord</h2>
      <p className="text-sm text-gray-400 mb-6">
        Run <strong>/link</strong> in your Discord server to get an 8-character code (e.g. 57F2D895).
      </p>

      <form onSubmit={handleLink} className="space-y-4">
        <div>
          <input
            type="text"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8))}
            placeholder="57F2D895"
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:border-blue-500 transition-colors"
            required
          />
        </div>

        <button
          type="submit"
          disabled={status === "loading" || !/^[A-Z0-9]{6,8}$/.test(code.trim().toUpperCase())}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-400 font-semibold rounded-lg transition-colors"
        >
          {status === "loading" ? "Verifying..." : "Link Account"}
        </button>
      </form>

      {message && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm ${
            status === "success" ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
