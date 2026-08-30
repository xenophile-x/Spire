import { createClient } from "@supabase/supabase-js";
import { isInDiscordClient } from "@/services/discordService";

const supabaseUrl = isInDiscordClient()
  ? "/.proxy/api/supabase"
  : import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables in .env.local!");
}

function isTransientNetworkError(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("networkerror") ||
    msg.includes("network connection was lost") ||
    msg.includes("failed to send a request") ||
    msg.includes("network request failed") ||
    msg.includes("fetch failed") ||
    msg.includes("the internet connection appears to be offline") ||
    msg.includes("typeerror: cancelled")
  );
}

function isTransientStatus(status) {
  return status === 502 || status === 503 || status === 504 || status === 429;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(input, init) {
  // PKCE code exchange is single-use — never retry auth endpoints or we
  // burn the code and Supabase wraps the second attempt as
  // "Unable to exchange external code: 4/0A...".
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : typeof input?.url === "string"
          ? input.url
          : "";
  if (rawUrl.includes("/auth/v1/")) {
    return fetch(input, init);
  }

  const maxRetries = 3;
  const baseDelay = 500;

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);
      if (isTransientStatus(response.status) && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await new Promise((resolve) => {
            const onOnline = () => {
              window.removeEventListener("online", onOnline);
              resolve();
            };
            window.addEventListener("online", onOnline, { once: true });
            setTimeout(() => {
              window.removeEventListener("online", onOnline);
              resolve();
            }, 5000);
          });
        } else {
          await sleep(delay);
        }
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      const shouldRetry = isTransientNetworkError(err) && attempt < maxRetries;
      if (!shouldRetry) throw err;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await new Promise((resolve) => {
          const onOnline = () => {
            window.removeEventListener("online", onOnline);
            resolve();
          };
          window.addEventListener("online", onOnline, { once: true });
          setTimeout(() => {
            window.removeEventListener("online", onOnline);
            resolve();
          }, 3000);
        });
      } else {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: fetchWithRetry,
  },
});