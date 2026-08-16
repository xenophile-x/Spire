// import React, { createContext, useContext, useEffect, useState } from "react";
// import { supabase } from "@/lib/supabaseClient";
// import {
//   setDriveAccessToken,
//   clearDriveAccessToken,
//   getDriveAccessToken,
//   getDriveTokenTimestamp,
// } from "@/utils/auth";

// const AuthContext = createContext({});

// const TOKEN_MAX_AGE_MS = 50 * 60 * 1000; // treat as stale after 50 min

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [session, setSession] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [driveToken, setDriveToken] = useState(getDriveAccessToken());

//   // Saves the Google tokens returned at login into your Supabase table,
//   // via a REST insert/upsert (RLS lets the user write their own row).
//   const persistGoogleTokens = async (session) => {
//     if (!session?.provider_token || !session?.user?.id) return;

//     const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString(); // Google default ~1hr

//     const payload = {
//       user_id: session.user.id,
//       access_token: session.provider_token,
//       expires_at: expiresAt,
//     };

//     // Only include refresh_token if Google actually gave us one
//     // (it's only sent on first consent, with access_type: "offline")
//     if (session.provider_refresh_token) {
//       payload.refresh_token = session.provider_refresh_token;
//     }

//     const { error } = await supabase
//       .from("google_oauth_tokens")
//       .upsert(payload, { onConflict: "user_id" });

//     if (error) {
//       console.error("[Auth] Failed to persist Google tokens:", error);
//     }
//   };

//   useEffect(() => {
//     supabase.auth
//       .getSession()
//       .then(({ data: { session } }) => {
//         setSession(session);
//         setUser(session?.user ?? null);

//         if (session?.provider_token) {
//           setDriveAccessToken(session.provider_token);
//           setDriveToken(session.provider_token);
//           persistGoogleTokens(session);
//         }
//         setLoading(false);
//       })
//       .catch((err) => {
//         console.error("Failed to get session:", err);
//         setLoading(false);
//       });

//     const {
//       data: { subscription },
//     } = supabase.auth.onAuthStateChange((event, session) => {
//       setSession(session);
//       setUser(session?.user ?? null);

//       if (session?.provider_token) {
//         setDriveAccessToken(session.provider_token);
//         setDriveToken(session.provider_token);
//         persistGoogleTokens(session);
//       } else if (event === "SIGNED_OUT") {
//         clearDriveAccessToken();
//         setDriveToken(null);
//       }

//       setLoading(false);
//     });

//     return () => {
//       subscription?.unsubscribe();
//     };
//   }, []);

//   const signInWithGoogle = async () => {
//     const { error } = await supabase.auth.signInWithOAuth({
//       provider: "google",
//       options: {
//         scopes: "https://www.googleapis.com/auth/drive.file",
//         queryParams: {
//           access_type: "offline",
//           prompt: "consent",
//         },
//         redirectTo: window.location.origin,
//       },
//     });

//     if (error) console.error("Error logging in with Google:", error.message);
//   };

//   const signOut = async () => {
//     try {
//       await supabase.auth.signOut();
//     } catch (err) {
//       console.error("Sign out failed:", err);
//     } finally {
//       clearDriveAccessToken();
//       setDriveToken(null);
//     }
//   };

//   const isTokenStale = () => {
//     const issuedAt = getDriveTokenTimestamp();
//     if (!issuedAt) return true;
//     return Date.now() - issuedAt > TOKEN_MAX_AGE_MS;
//   };

//   // Calls the Edge Function, which uses the stored refresh_token
//   // server-side to get a genuinely new Google access_token.
//   const refreshGoogleToken = async () => {
//     try {
//       const {
//         data: { session: currentSession },
//       } = await supabase.auth.getSession();

//       if (!currentSession?.access_token) {
//         console.warn("[Auth] No active Supabase session to authorize refresh call.");
//         return null;
//       }

//       const { data, error } = await supabase.functions.invoke("refresh-google-token", {
//         headers: {
//           Authorization: `Bearer ${currentSession.access_token}`,
//         },
//       });

//       if (error || !data?.access_token) {
//         console.warn("[Auth] Google token refresh failed:", error?.message || data?.error);
//         return null;
//       }

//       setDriveAccessToken(data.access_token);
//       setDriveToken(data.access_token);
//       return data.access_token;
//     } catch (err) {
//       console.error("[Auth] refreshGoogleToken threw:", err);
//       return null;
//     }
//   };

//   return (
//     <AuthContext.Provider
//       value={{
//         user,
//         session,
//         loading,
//         googleAccessToken: driveToken,
//         signInWithGoogle,
//         signOut,
//         refreshGoogleToken,
//         isTokenStale,
//       }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// };

// // eslint-disable-next-line react/only-export-components
// export const useAuth = () => useContext(AuthContext);


import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  setDriveAccessToken,
  clearDriveAccessToken,
  getDriveAccessToken,
  getDriveTokenTimestamp,
} from "@/utils/auth";

const AuthContext = createContext({});

const TOKEN_MAX_AGE_MS = 50 * 60 * 1000; // treat as stale after 50 min

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driveToken, setDriveToken] = useState(getDriveAccessToken());

  // Saves the Google tokens returned at login into your Supabase table,
  // via a REST insert/upsert (RLS lets the user write their own row).
  const persistGoogleTokens = async (session) => {
    if (!session?.provider_token || !session?.user?.id) return;

    const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString(); // real access-token expiry (~1hr)
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // no re-login for 1 month

    const payload = {
      user_id: session.user.id,
      access_token: session.provider_token,
      expires_at: expiresAt,
      session_expires_at: sessionExpiresAt,
    };

    // Only include refresh_token if Google actually gave us one
    // (it's only sent on first consent, with access_type: "offline")
    if (session.provider_refresh_token) {
      payload.refresh_token = session.provider_refresh_token;
    }

    const { error } = await supabase
      .from("google_oauth_tokens")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.error("[Auth] Failed to persist Google tokens:", error);
    }
  };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

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
    // 💡 Create a clean redirect string that handles local vs production automatically
    const targetRedirect = typeof window !== 'undefined' ? `${window.location.origin}/` : '';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/drive.file",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        redirectTo: targetRedirect, // 💡 Use the clean string here
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

  // Calls the Edge Function, which uses the stored refresh_token
  // server-side to get a genuinely new Google access_token.
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

// eslint-disable-next-line react/only-export-components
export const useAuth = () => useContext(AuthContext);