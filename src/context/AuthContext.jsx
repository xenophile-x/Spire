


import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  setDriveAccessToken,
  clearDriveAccessToken,
  getDriveAccessToken,
  getDriveTokenTimestamp,
} from "@/utils/auth";

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


  const persistGoogleTokens = async (session) => {
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
        console.error("[Auth] Failed to persist Google tokens:", error);
      }
    } catch (err) {
      console.error("[Auth] Failed to persist Google tokens:", err);
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

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/drive.file",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        redirectTo: targetRedirect,
      },
    });

    if (error) console.error("Error logging in with Google:", error.message);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      clearDriveAccessToken();
      setDriveToken(null);
    }
  };

  const isTokenStale = () => {
    const issuedAt = getDriveTokenTimestamp();
    if (!issuedAt) return true;
    return Date.now() - issuedAt > TOKEN_MAX_AGE_MS;
  };


  const refreshGoogleToken = async () => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        console.warn("[Auth] No active Supabase session to authorize refresh call.");
        return null;
      }

      const { data, error } = await supabase.functions.invoke("refresh-google-token", {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });

      if (error || !data?.access_token) {
        console.warn("[Auth] Google token refresh failed:", error?.message || data?.error);
        return null;
      }

      setDriveAccessToken(data.access_token);
      setDriveToken(data.access_token);
      return data.access_token;
    } catch (err) {
      console.error("[Auth] refreshGoogleToken threw:", err);
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