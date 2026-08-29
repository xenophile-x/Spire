import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

/**
 * GoogleConnect — Vite + React (secure)
 *
 * This repo intentionally BLOCKS direct browser access to `google_oauth_tokens`:
 *  - supabase/migrations/20260825220000_lock_oauth_tokens_table.sql:14
 *    REVOKE ALL ON google_oauth_tokens FROM anon, authenticated
 *  - supabase/migrations/20260825200000_security_hardening_phase2.sql:158
 *    DROP POLICY "Users can view their own oauth token"
 *
 * Tokens are persisted exclusively via Edge Function `store-google-token`
 * (service_role) — see src/context/AuthContext.jsx:61 persistGoogleTokens().
 * The browser never does supabase.from('google_oauth_tokens').upsert().
 * Doing so would 403 and leak refresh_token to XSS.
 *
 * Likewise, status checks must NOT do supabase.from('google_oauth_tokens').select().
 * Use a server probe (refresh-google-token) or add a dedicated check endpoint.
 */
export default function GoogleConnect() {
  const { user, signInWithGoogle } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Secure status probe: ask server if a refresh_token exists.
  // Direct SELECT would 403 per 20260825220000_lock_oauth_tokens_table.sql.
  // We reuse refresh-google-token as a probe; ideally add a lightweight
  // check-google-connection function that only SELECTs without refreshing.
  useEffect(() => {
    let cancelled = false;
    const checkConnection = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setIsConnected(false);
          setLoading(false);
        }
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (!cancelled) setLoading(false);
          return;
        }
        // Probe server — do not touch google_oauth_tokens from client.
        const { data, error } = await supabase.functions.invoke("refresh-google-token", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        // refresh-google-token returns 400 "No refresh token on file" when not connected
        // vs 200 with access_token when connected. Treat any 200 as connected.
        if (!error && data?.access_token) setIsConnected(true);
        else setIsConnected(false);
      } catch {
        if (!cancelled) setIsConnected(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    checkConnection();
    return () => { cancelled = true; };
  }, [user?.id]);

  // AuthContext already listens to SIGNED_IN and calls store-google-token:
  // src/context/AuthContext.jsx:140 onAuthStateChange -> persistGoogleTokens()
  // So we do NOT need a second onAuthStateChange that does client-side upsert.
  // That upsert in the prompt (`supabase.from('google_oauth_tokens').upsert(...)`)
  // would fail with 403 after the lock migration.

  const handleConnect = async () => {
    setError("");
    try {
      // Uses src/context/AuthContext.jsx:166 signInWithGoogle which already sets:
      //   scopes: "https://www.googleapis.com/auth/drive.file" (least privilege)
      //   queryParams: { access_type: 'offline', prompt: 'consent' }
      //   redirectTo: window.location.origin
      // Do not change to drive.readonly unless you update Google Cloud console
      // and accept broader scope. drive.file is what googleTokenClient.js:1 expects.
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || "Failed to start Google OAuth");
    }
  };

  if (loading) return <div className="text-gray-400">Loading Drive status...</div>;

  return (
    <div className="p-6 max-w-md mx-auto bg-gray-900 rounded-xl shadow-md border border-gray-800 text-white mt-6">
      <h2 className="text-xl font-bold mb-2">Google Drive</h2>
      <p className="text-sm text-gray-400 mb-6">
        Connect your Google Drive so Spire can stream your music files.
      </p>

      {isConnected ? (
        <div className="p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-300 text-center font-medium">
          ✅ Google Drive Connected
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full py-3 px-4 bg-white text-gray-900 hover:bg-gray-100 font-bold rounded-lg transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Connect Google Drive
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <p className="mt-3 text-xs text-gray-500">
        Secure: tokens are stored server-side via <code>store-google-token</code> (service_role). Browser has no read/write on <code>google_oauth_tokens</code>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ❌ INSECURE pattern from prompt — DO NOT USE (will 403 after hardening):
// useEffect(() => { supabase.from('google_oauth_tokens').select('id').eq('user_id', userId).single() })
// supabase.auth.onAuthStateChange(async (event, session) => {
//   await supabase.from('google_oauth_tokens').upsert({ user_id: userId, access_token: session.provider_token, refresh_token: session.provider_refresh_token, ... })
// })
// RLS "Users can manage their own tokens" FOR ALL USING (auth.uid()=user_id) re-exposes
// refresh_tokens to XSS and bypasses server validation (expires_at, scope). Blocked by
// supabase/migrations/20260825220000_lock_oauth_tokens_table.sql:17 REVOKE.
// ---------------------------------------------------------------------------
