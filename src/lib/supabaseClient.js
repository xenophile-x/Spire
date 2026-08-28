import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
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
  const maxRetries = 3;
  const baseDelay = 500;

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);
      // Retry on transient HTTP statuses (gateway errors, rate limit)
      if (isTransientStatus(response.status) && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        // If offline, wait longer and check online status
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await new Promise((resolve) => {
            const onOnline = () => {
              window.removeEventListener("online", onOnline);
              resolve();
            };
            window.addEventListener("online", onOnline, { once: true });
            // fallback after 5s even if still offline
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

      // Don't hammer retries while offline — wait for online event or backoff
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
