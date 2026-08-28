


import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  setDriveAccessToken,
  clearDriveAccessToken,
  getDriveAccessToken,
  getDriveTokenTimestamp,
} from "@/utils/auth";
import {
  getGoogleAccessToken,
  clearGoogleAccessTokenCache,
} from "@/lib/googleTokenClient";
import { isInDiscordClient, openExternalLink } from "@/services/discordService";

const AuthContext = createContext({});

const TOKEN_MAX_AGE_MS = 50 * 60 * 1000;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_START_KEY = "spire:session:started_at";


const markSessionStart = () => {


  if (!localStorage.getItem(SESSION_START_KEY)) {
    localStorage.setItem(SESSION_START_KEY, String(Date.now()));
  }
};

const clearSessionStart = () => localStorage.removeItem(SESSION_START_KEY);

const enforceSessionMaxAge = async () => {
  const startedAt = Number(localStorage.getItem(SESSION_START_KEY));
  if (!startedAt || Date.now() - startedAt <= SESSION_MAX_AGE_MS) return false;
  console.info("[Auth] Session exceeded absolute 30-day lifetime — signing out.");
  await supabase.auth.signOut();
  clearSessionStart();
  return true;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driveToken, setDriveToken] = useState(getDriveAccessToken());


  const isNetworkPersistError = (err) => {
    const msg = String(err?.message || err || "").toLowerCase();
    return (
      msg.includes("failed to fetch") ||
      msg.includes("load failed") ||
      msg.includes("network") ||
      msg.includes("failed to send a request")
    );
  };

  const persistGoogleTokens = async (session, attempt = 0) => {
    if (!session?.provider_token || !session?.user?.id || !session?.access_token) return;

    try {
      // Tokens are persisted server-side (service role) — the browser has no
      // direct access to google_oauth_tokens.
      const { error } = await supabase.functions.invoke("store-google-token", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          access_token: session.provider_token,
          ...(session.provider_refresh_token
            ? { refresh_token: session.provider_refresh_token }
            : {}),
          expires_in: 55 * 60,
        },
      });

      if (error) {
        if (isNetworkPersistError(error) && attempt < 2) {
          const delay = 1000 * Math.pow(2, attempt);
          console.warn(`[Auth] Token persist deferred (network) — retrying in ${delay}ms`);
          setTimeout(() => persistGoogleTokens(session, attempt + 1), delay);
        } else if (isNetworkPersistError(error)) {
          console.warn("[Auth] Token persist skipped while offline — will retry on next sign-in/online:", error.message || error);
          // Queue retry when online
          const onOnline = () => {
            window.removeEventListener("online", onOnline);
            persistGoogleTokens(session, 0);
          };
          window.addEventListener("online", onOnline, { once: true });
        } else {
          console.warn("[Auth] Failed to persist Google tokens:", error.message || error);
        }
      }
    } catch (err) {
      if (isNetworkPersistError(err) && attempt < 2) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`[Auth] Token persist network error — retrying in ${delay}ms`);
        setTimeout(() => persistGoogleTokens(session, attempt + 1), delay);
      } else if (isNetworkPersistError(err)) {
        console.warn("[Auth] Token persist offline — queued for retry:", err.message || err);
        const onOnline = () => {
          window.removeEventListener("online", onOnline);
          persistGoogleTokens(session, 0);
        };
        window.addEventListener("online", onOnline, { once: true });
      } else {
        console.warn("[Auth] Failed to persist Google tokens:", err?.message || err);
      }
    }
  };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        let activeSession = session;
        if (activeSession) {


          markSessionStart();
          if (await enforceSessionMaxAge()) activeSession = null;
        }

        setSession(activeSession);
        setUser(activeSession?.user ?? null);

        if (activeSession?.provider_token) {
          setDriveAccessToken(activeSession.provider_token);
          setDriveToken(activeSession.provider_token);
          persistGoogleTokens(activeSession);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to get session:", err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") markSessionStart();
      if (event === "SIGNED_OUT") clearSessionStart();

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.provider_token) {
        setDriveAccessToken(session.provider_token);
        setDriveToken(session.provider_token);
        persistGoogleTokens(session);
      } else if (event === "SIGNED_OUT") {
        clearDriveAccessToken();
        setDriveToken(null);
      }

      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const targetRedirect = typeof window !== 'undefined' ? `${window.location.origin}/` : '';
    const inDiscord = isInDiscordClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/drive.file",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        redirectTo: targetRedirect,
        skipBrowserRedirect: inDiscord,
      },
    });

    if (error) {
      console.error("Error logging in with Google:", error.message);
      return;
    }

    if (inDiscord && data?.url) {
      try {
        await openExternalLink(data.url);
      } catch (sdkError) {
        console.error("Failed to open external link via Discord SDK:", sdkError);
      }
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      clearDriveAccessToken();
      clearGoogleAccessTokenCache();
      setDriveToken(null);
    }
  };

  const isTokenStale = () => {
    const issuedAt = getDriveTokenTimestamp();
    if (!issuedAt) return true;
    return Date.now() - issuedAt > TOKEN_MAX_AGE_MS;
  };


  const refreshGoogleToken = async () => {
    // Don't attempt network refresh while offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.warn("[Auth] Skipping Google token refresh while offline");
      return getDriveAccessToken() || null;
    }
    // 1) Preferred: server-side refresh via the stored Google refresh token.
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (currentSession?.access_token) {
        const { data, error } = await supabase.functions.invoke("refresh-google-token", {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        });

        if (!error && data?.access_token) {
          setDriveAccessToken(data.access_token);
          setDriveToken(data.access_token);
          return data.access_token;
        }
        const msg = String(error?.message || data?.error || "").toLowerCase();
        const isNet = msg.includes("failed to fetch") || msg.includes("load failed") || msg.includes("network");
        if (isNet) {
          console.warn("[Auth] Google token refresh deferred (offline):", error?.message || data?.error);
        } else {
          console.warn("[Auth] Google token refresh failed:", error?.message || data?.error);
        }
      } else {
        console.warn("[Auth] No active Supabase session to authorize refresh call.");
      }
    } catch (err) {
      const isNet = isNetworkPersistError(err);
      if (isNet) console.warn("[Auth] refreshGoogleToken network deferred:", err?.message || err);
      else console.warn("[Auth] refreshGoogleToken threw:", err);
    }

    // 2) Fallback: silently mint a fresh short-lived token in the browser.
    //    Supabase's managed Google OAuth does not hand us a provider refresh
    //    token, so this is what keeps Drive uploads (and stream-track, via the
    //    server-side copy below) alive past the first hour of a session — as
    //    long as the owner's tab is open and their Google session persists.
    if (typeof navigator !== "undefined" && !navigator.onLine) return null;
    try {
      const token = await getGoogleAccessToken();
      setDriveAccessToken(token);
      setDriveToken(token);

      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        if (currentSession?.access_token) {
          supabase.functions
            .invoke("store-google-token", {
              headers: { Authorization: `Bearer ${currentSession.access_token}` },
              body: { access_token: token, expires_in: 55 * 60 },
            })
            .catch((err) => {
              if (isNetworkPersistError(err)) console.warn("[Auth] Persist refreshed token deferred (offline)");
              else console.warn("[Auth] Failed to persist refreshed token:", err);
            });
        }
      } catch {}

      return token;
    } catch (err) {
      console.warn("[Auth] Browser-side Google token mint failed:", err?.message || err);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        googleAccessToken: driveToken,
        signInWithGoogle,
        signOut,
        refreshGoogleToken,
        isTokenStale,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => useContext(AuthContext);