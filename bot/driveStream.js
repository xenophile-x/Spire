const { Readable } = require('stream');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_SECRET = process.env.BOT_SECRET;
if (!BOT_SECRET) throw new Error('BOT_SECRET is required. Do not fall back to DISCORD_BOT_TOKEN.');


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

/**
 * Obtains a valid Google Drive Access Token via Supabase Edge Function.
 */
async function getValidAccessToken(discordId) {
  if (!/^\d{17,20}$/.test(discordId)) {
    throw new Error('Invalid Discord ID format.');
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables are missing.');
  }

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
    const errorPayload = await res.json().catch(() => ({}));
    throw new Error(errorPayload.error || `Token authorization failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('No access token returned from Edge Function.');
  }
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
 */
async function createDriveAudioResource(discordId, driveFileId, opts = {}) {
  const maxRetries = opts.retries ?? 2;
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