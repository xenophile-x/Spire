const SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = "https://accounts.google.com/gsi/client";

let scriptPromise = null;
let tokenClient = null;
let pendingRequest = null;
let cached = null;

function loadGsiScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity Services."))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Google Identity Services."));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function ensureTokenClient() {
  if (!CLIENT_ID) {
    throw new Error("Google client ID is not configured (VITE_GOOGLE_CLIENT_ID).");
  }
  if (tokenClient) return tokenClient;

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (resp) => {
      const pending = pendingRequest;
      pendingRequest = null;
      if (!pending) return;
      if (resp.error || !resp.access_token) {
        pending.reject(
          Object.assign(
            new Error(resp.error_description || resp.error || "Google returned no access token."),
            { code: resp.error || "unknown" }
          )
        );
      } else {
        pending.resolve(resp);
      }
    },
  });
  return tokenClient;
}

function requestToken(client) {
  if (pendingRequest) return pendingRequest.promise;

  let resolveFn;
  let rejectFn;
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  pendingRequest = { promise, resolve: resolveFn, reject: rejectFn };

  const timeout = setTimeout(() => {
    const pending = pendingRequest;
    pendingRequest = null;
    pending?.reject(new Error("Timed out waiting for Google authorization."));
  }, 30000);

  pendingRequest.promise.finally(() => clearTimeout(timeout)).catch(() => {});

  try {
    client.requestAccessToken({ prompt: "" });
  } catch (err) {
    const pending = pendingRequest;
    pendingRequest = null;
    clearTimeout(timeout);
    pending?.reject(err instanceof Error ? err : new Error(String(err)));
  }

  return pendingRequest.promise;
}

export async function getGoogleAccessToken(minTtlMs = 120000) {
  if (cached && cached.expiresAt - Date.now() > minTtlMs) {
    return cached.token;
  }

  await loadGsiScript();
  const client = ensureTokenClient();
  const resp = await requestToken(client);

  const expiresInMs = (typeof resp.expires_in === "number" ? resp.expires_in : 3600) * 1000;
  cached = { token: resp.access_token, expiresAt: Date.now() + expiresInMs };
  return cached.token;
}

export function clearGoogleAccessTokenCache() {
  cached = null;
}

// ---------------------------------------------------------------------------
// Offline (authorization-code) flow — the permanent fix for shared streaming.
// Requests an authorization code with access_type=offline so Google issues a
// long-lived refresh token. The code is exchanged server-side (the client
// secret never touches the browser); see supabase/functions/store-google-token.
// ---------------------------------------------------------------------------

let codeClient = null;
let pendingCodeRequest = null;

function ensureCodeClient() {
  if (!CLIENT_ID) {
    throw new Error("Google client ID is not configured (VITE_GOOGLE_CLIENT_ID).");
  }
  if (codeClient) return codeClient;

  codeClient = window.google.accounts.oauth2.initCodeClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    ux_mode: "popup",
    access_type: "offline",
    prompt: "consent",
    callback: (resp) => {
      const pending = pendingCodeRequest;
      pendingCodeRequest = null;
      if (!pending) return;
      if (!resp.code) {
        pending.reject(
          Object.assign(
            new Error(resp.error_description || resp.error || "No authorization code returned."),
            { code: resp.error || "unknown" }
          )
        );
      } else {
        pending.resolve(resp.code);
      }
    },
  });
  return codeClient;
}

export async function requestGoogleAuthCode() {
  await loadGsiScript();
  const client = ensureCodeClient();

  if (pendingCodeRequest) return pendingCodeRequest.promise;

  let resolveFn;
  let rejectFn;
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  pendingCodeRequest = { promise, resolve: resolveFn, reject: rejectFn };

  try {
    client.requestCode();
  } catch (err) {
    pendingCodeRequest = null;
    throw err instanceof Error ? err : new Error(String(err));
  }

  return pendingCodeRequest.promise;
}
