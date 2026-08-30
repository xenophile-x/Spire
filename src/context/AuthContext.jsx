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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driveToken, setDriveToken] = useState(getDriveAccessToken());

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
    const targetRedirect = typeof window !== "undefined" ? `${window.location.origin}/` : "";
    const { data, error } = await supabase.auth.signInWithOAuth({
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
      return;
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
