import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getDriveAccessToken, setDriveAccessToken, clearDriveAccessToken } from "@/utils/auth";

const AuthContext = createContext({});

const persistGoogleTokens = async (session) => {
  if (!session?.provider_token || !session?.user?.id || !session?.access_token) return;
  try {
    await supabase.functions.invoke("store-google-token", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        access_token: session.provider_token,
        ...(session.provider_refresh_token ? { refresh_token: session.provider_refresh_token } : {}),
        expires_in: 55 * 60,
      },
    });
  } catch (err) {
    console.warn("[Auth] Failed to persist Google tokens:", err);
  }
};

const CANONICAL_SITE_URL = "https://spire-wheat-ten.vercel.app";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driveToken, setDriveToken] = useState(getDriveAccessToken());
  const signInInProgressRef = React.useRef(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.access_token) {
          setDriveAccessToken(session.access_token);
        }
        if (session?.provider_token) {
          setDriveAccessToken(session.provider_token);
          setDriveToken(session.provider_token);
          persistGoogleTokens(session);
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
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.access_token) {
        setDriveAccessToken(session.access_token);
      }

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
    if (signInInProgressRef.current) return;
    signInInProgressRef.current = true;
    try {
      // Use canonical prod URL for Vercel previews so redirectTo always
      // matches Supabase allow-list (dynamic preview origins are not
      // allow-listed — Supabase would fallback to Site URL and the PKCE
      // code_verifier stored for the preview origin would be lost,
      // surfacing as "Unable to exchange external code: 4/0A").
      // Local dev keeps its own origin so http://localhost:5173/* works.
      const isLocal =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const targetRedirect = isLocal
        ? `${window.location.origin}/`
        : `${CANONICAL_SITE_URL}/`;

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

      if (error) {
        console.error("Error logging in with Google:", error.message);
        signInInProgressRef.current = false;
        return;
      }
      // Let the browser navigate away — do not reset the guard until
      // the page unloads, prevents double-click from creating two PKCE
      // verifiers and invalidating the first code (4/0A).
    } catch (err) {
      console.error("Error logging in with Google:", err);
      signInInProgressRef.current = false;
    }
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

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        googleAccessToken: driveToken,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
