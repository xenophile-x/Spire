const { Readable } = require('stream');
const { createAudioResource } = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_SECRET = process.env.BOT_SECRET || process.env.DISCORD_BOT_TOKEN;

/**
 * Sanitize Drive query fragments for Drive q= syntax
 * @param {string} value
 */
function escapeDriveQuery(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Get valid Google Drive access token via Supabase Edge Function
 * Auto-refreshes if expires within 5 min (3600s Google TTL handled server-side with 300s buffer)
 * @param {string} discordId - 17-20 digit snowflake
 * @returns {Promise<string>} access_token
 */
async function getValidAccessToken(discordId) {
  if (!/^\d{17,20}$/.test(discordId)) throw new Error('Invalid discord_id');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase not configured');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-drive-access-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'x-bot-secret': BOT_SECRET,
    },
    body: JSON.stringify({ discord_id: discordId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to get access token: ${res.status}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token returned');
  return data.access_token;
}

/**
 * Thin wrapper for Drive API JSON requests
 */
async function driveRequest(accessToken, endpoint, options = {}) {
  const res = await fetch(`https://www.googleapis.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive API error ${res.status}: ${body.slice(0,300)}`);
  }
  return res.json();
}

/**
 * Create Discord audio resource directly from Drive file stream
 * @param {string} discordId - owner discord id for token lookup
 * @param {string} driveFileId - Google Drive fileId
 * @param {object} opts - { retries: number }
 */
async function createDriveAudioResource(discordId, driveFileId, opts = {}) {
  const retries = opts.retries ?? 1;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const accessToken = await getValidAccessToken(discordId);
      const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!driveResponse.ok) {
        // 401/403 often means token just expired between check and fetch - retry once (Edge Function will refresh)
        if ((driveResponse.status === 401 || driveResponse.status === 403) && attempt < retries) {
          await new Promise(r => setTimeout(r, 300));
          continue;
        }
        throw new Error(`Drive stream failed: ${driveResponse.status} ${driveResponse.statusText}`);
      }
      if (!driveResponse.body) throw new Error('Empty drive stream body');
      const nodeStream = Readable.fromWeb(driveResponse.body);
      nodeStream.on('error', e => console.error('[driveStream] stream error', e));
      return createAudioResource(nodeStream, {
        inputType: 'arbitrary',
        inlineVolume: true,
        ffmpeg: ffmpegPath,
      });
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        console.warn(`[driveStream] attempt ${attempt+1} failed, retrying:`, e.message);
        await new Promise(r => setTimeout(r, 400 * (attempt+1)));
      }
    }
  }
  throw lastErr;
}

module.exports = {
  escapeDriveQuery,
  getValidAccessToken,
  driveRequest,
  createDriveAudioResource,
};
