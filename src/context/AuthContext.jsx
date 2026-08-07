// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { setDriveAccessToken, clearDriveAccessToken, getDriveAccessToken } from "@/utils/auth";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driveToken, setDriveToken] = useState(getDriveAccessToken());

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.provider_token) {
          setDriveAccessToken(session.provider_token);
          setDriveToken(session.provider_token);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to get session:", err);
        setLoading(false);
      });

    // 2. Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.provider_token) {
        setDriveAccessToken(session.provider_token);
        setDriveToken(session.provider_token);
      } else if (event === "SIGNED_OUT") {
        clearDriveAccessToken();
        setDriveToken(null);
      }

      setLoading(false);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  /**
   * Triggers Google Login requesting Google Drive file access scopes.
   */
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/drive.file",
        redirectTo: window.location.origin,
      },
    });
    if (error) console.error("Error logging in with Google:", error.message);
  };

  /**
   * Sign out user and purge stored OAuth credentials.
   */
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

  /**
   * Refreshes the Supabase session and updates the stored Google access token.
   * Use this when Drive API calls fail with 401.
   */
  const refreshGoogleToken = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error("Failed to refresh session:", error);
      return null;
    }

    const newToken = data.session?.provider_token;
    if (newToken) {
      setDriveAccessToken(newToken);
      setDriveToken(newToken);
    }

    return newToken;
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);