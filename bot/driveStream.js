const { Readable } = require('stream');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const prism = require('prism-media');
const ffmpegPath = require('ffmpeg-static');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_SECRET = process.env.BOT_SECRET;
if (!BOT_SECRET) throw new Error('BOT_SECRET is required. Set a random 32+ char secret in bot env and in Supabase Edge env. Do not fall back to DISCORD_BOT_TOKEN.');
if (BOT_SECRET.length < 16) throw new Error('BOT_SECRET too short — use at least 16 characters');

function escapeDriveQuery(value) {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}
function buildDriveQuery(term, mimeType = null) {
  const safeTerm = escapeDriveQuery(term);
  let query = `name contains '${safeTerm}' and trashed = false`;
  if (mimeType) {
    if (mimeType.includes('*') || mimeType.includes('/')) {
      query += ` and mimeType contains '${mimeType}'`;
    } else {
      query += ` and mimeType = '${mimeType}'`;
    }
  }
  return query;
}

// Cache downstream access tokens so autocomplete keystrokes don't hit the
// edge function (cold start ~1-2s) on every request. Access tokens are valid
// ~1h; we cache well under that to react quickly to revocation.
const ACCESS_TOKEN_CACHE = new Map(); // discordId -> { token, expiresAt }
const ACCESS_TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_CACHE_MAX = 200;

function cacheAccessToken(discordId, token) {
  if (ACCESS_TOKEN_CACHE.size >= ACCESS_TOKEN_CACHE_MAX) {
    const oldest = ACCESS_TOKEN_CACHE.keys().next().value;
    if (oldest !== undefined) ACCESS_TOKEN_CACHE.delete(oldest);
  }
  ACCESS_TOKEN_CACHE.set(discordId, { token, expiresAt: Date.now() + ACCESS_TOKEN_CACHE_TTL_MS });
}

async function getValidAccessToken(discordId) {
  if (!/^\d{17,20}$/.test(discordId)) {
    throw new Error('Invalid Discord ID format.');
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables are missing.');
  }

  const cached = ACCESS_TOKEN_CACHE.get(discordId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-drive-access-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'x-bot-secret': BOT_SECRET
    },
    body: JSON.stringify({ discord_id: discordId })
  });

  if (!res.ok) {
    // A 401/404 can mean the key/env changed or account unlinked — drop any cache.
    ACCESS_TOKEN_CACHE.delete(discordId);
    const errorPayload = await res.json().catch(() => ({}));
    throw new Error(errorPayload.error || `Token authorization failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('No access token returned from Edge Function.');
  }
  cacheAccessToken(discordId, data.access_token);
  return data.access_token;
}

/**
 * Executes a request against Google Drive v3 REST API.
 */
async function driveRequest(accessToken, endpoint, options = {}) {
  const res = await fetch(`https://www.googleapis.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Google Drive API error (${res.status}): ${errorText.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Retrieves Google Drive audio file and returns a Discord AudioResource.
 * Supports seeking via `opts.seek` (seconds from start, 0 = from beginning).
 */
async function createDriveAudioResource(discordId, driveFileId, opts = {}) {
  const maxRetries = opts.retries ?? 2;
  const seekSeconds = Math.max(0, Number(opts.seek) || 0);
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const accessToken = await getValidAccessToken(discordId);
      const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!driveResponse.ok) {
        if ((driveResponse.status === 401 || driveResponse.status === 403) && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        throw new Error(`Drive stream fetch failed: HTTP ${driveResponse.status} ${driveResponse.statusText}`);
      }

      if (!driveResponse.body) {
        throw new Error('Drive stream returned empty response body.');
      }

      const nodeStream = Readable.fromWeb(driveResponse.body);
      nodeStream.on('error', err => console.error('[Audio Engine] Stream reading error:', err.message));

      // If seek is requested, pipe through FFmpeg with -ss to skip to that position.
      // We manually create an FFmpeg instance that seeks and outputs raw PCM (s16le 48k stereo)
      // then create a Raw audio resource — discord.js will Opus-encode it.
      if (seekSeconds > 0) {
        const ffmpegArgs = [
          '-ss', String(seekSeconds),
          '-i', 'pipe:0',
          '-analyzeduration', '0',
          '-loglevel', '0',
          '-f', 's16le',
          '-ar', '48000',
          '-ac', '2',
        ];
        const ffmpeg = new prism.FFmpeg({ args: ffmpegArgs });
        ffmpeg.on('error', err => console.error('[Audio Engine] FFmpeg seek error:', err.message));
        // Pass seek info to resource for debugging
        nodeStream.pipe(ffmpeg);
        // Small delay to let ffmpeg spawn — createAudioResource will handle opus encoding from raw
        return createAudioResource(ffmpeg, {
          inputType: StreamType.Raw,
          inlineVolume: true,
        });
      }

      return createAudioResource(nodeStream, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
        ffmpeg: ffmpegPath
      });
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

module.exports = {
  escapeDriveQuery,
  buildDriveQuery,
  getValidAccessToken,
  driveRequest,
  createDriveAudioResource
};