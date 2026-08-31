require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const crypto = require('crypto');
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  EmbedBuilder
} = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  getVoiceConnection,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

const {
  getValidAccessToken,
  driveRequest,
  createDriveAudioResource,
  buildDriveQuery
} = require('./driveStream');


const app = express();
app.use(express.json());

app.get('/', (_, res) => res.status(200).send('SPire Bot is active and running.'));
app.get('/health', (_, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[HTTP Server] Listening for health checks on port ${PORT}`));

// 2. Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// 3. State Management & Environment Variables
const queueMap = new Map();
const linkRateLimit = new Map();
const autocompleteCache = new Map(); // key -> { choices, expiresAt }
const VOICE_EXEMPT_COMMANDS = new Set(['stop', 'login', 'link', 'launch', 'playlists', 'songs', 'help', 'queue', 'nowplaying']);

// Auto-disconnect when voice channel empty for too long
const EMPTY_CHANNEL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const emptyChannelTimers = new Map(); // guildId -> Timeout

function cancelEmptyChannelDisconnect(guildId) {
  const timer = emptyChannelTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    emptyChannelTimers.delete(guildId);
    console.log(`[Auto-Disconnect] Cancelled empty-channel timer for guild ${guildId}`);
  }
}

function scheduleEmptyChannelDisconnect(guildId) {
  if (emptyChannelTimers.has(guildId)) return; // already scheduled
  console.log(`[Auto-Disconnect] Voice channel empty — scheduling leave in ${EMPTY_CHANNEL_TIMEOUT_MS / 60000} min for guild ${guildId}`);
  const timer = setTimeout(async () => {
    emptyChannelTimers.delete(guildId);
    const connection = getVoiceConnection(guildId);
    if (!connection) return;
    try {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        const channelId = connection.joinConfig?.channelId;
        const channel = channelId ? (guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null)) : null;
        if (channel && channel.isVoiceBased()) {
          const humanCount = channel.members.filter(m => !m.user.bot).size;
          if (humanCount > 0) {
            console.log(`[Auto-Disconnect] Cancelled — users rejoined in guild ${guildId}`);
            return;
          }
        }
      }
    } catch (e) {
      console.error('[Auto-Disconnect] Re-check failed, proceeding to disconnect:', e.message);
    }
    console.log(`[Auto-Disconnect] Leaving voice channel (empty for 5 min) — guild ${guildId}`);
    const queue = queueMap.get(guildId);
    if (queue) {
      try { queue.player.stop(true); } catch {}
      queue.tracks = [];
      queue.current = null;
      queue.playing = false;
      queue.seekOffset = 0;
      queue.playbackStartMs = null;
      queue.isSeeking = false;
    }
    try { connection.destroy(); } catch {}
  }, EMPTY_CHANNEL_TIMEOUT_MS);
  // Allow Node to exit even if timer is pending (Render/health checks)
  if (timer.unref) timer.unref();
  emptyChannelTimers.set(guildId, timer);
}

async function handleEmptyChannelState(guildId) {
  const connection = getVoiceConnection(guildId);
  if (!connection) {
    cancelEmptyChannelDisconnect(guildId);
    return;
  }
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channelId = connection.joinConfig?.channelId;
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isVoiceBased()) {
      cancelEmptyChannelDisconnect(guildId);
      return;
    }
    const humanCount = channel.members.filter(m => !m.user.bot).size;
    if (humanCount === 0) {
      scheduleEmptyChannelDisconnect(guildId);
    } else {
      cancelEmptyChannelDisconnect(guildId);
    }
  } catch (err) {
    console.error('[Auto-Disconnect] handleEmptyChannelState error:', err.message);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://spire-wheat-ten.vercel.app';

function getQueue(guildId) {
  if (!queueMap.has(guildId)) {
    const player = createAudioPlayer();

    player.on(AudioPlayerStatus.Idle, async () => {
      const queue = queueMap.get(guildId);
      // Ignore idle triggered by manual seek — we handle seek by directly playing new resource
      if (queue && queue.isSeeking) {
        queue.isSeeking = false;
        return;
      }
      try {
        // Loop handling — runs before advancing queue
        if (queue && queue.current) {
          if (queue.loopMode === 'track') {
            const connection = getVoiceConnection(guildId);
            if (connection) {
              try {
                const resource = await createDriveAudioResource(queue.current.requesterDiscordId, queue.current.id, { retries: 2, seek: 0 });
                connection.subscribe(queue.player);
                queue.player.play(resource);
                queue.playing = true;
                queue.seekOffset = 0;
                queue.playbackStartMs = Date.now();
                // keep current as-is, don't shift
                return;
              } catch (loopErr) {
                console.error(`[Loop Track Error] Guild ${guildId}:`, loopErr.message);
                // fall through to normal next handling
              }
            }
          } else if (queue.loopMode === 'queue') {
            // Move finished track to the end of the queue for looping queue
            queue.tracks.push(queue.current);
          }
        }

        if (queue && queue.tracks.length > 0) {
          const connection = getVoiceConnection(guildId);
          if (connection) {
            await playNext(guildId, connection);
          }
        } else if (queue) {
          queue.playing = false;
          queue.current = null;
          queue.seekOffset = 0;
          queue.playbackStartMs = null;
        }
      } catch (e) {
        console.error(`[Audio Player Idle Error] Guild ${guildId}:`, e.message);
        if (queue) {
          queue.playing = false;
          queue.current = null;
          queue.seekOffset = 0;
          queue.playbackStartMs = null;
        }
      }
    });

    player.on('error', error => {
      console.error(`[Audio Player Error] Guild ${guildId}:`, error.message);
      const queue = queueMap.get(guildId);
      if (queue && queue.tracks.length > 0) {
        const connection = getVoiceConnection(guildId);
        if (connection) playNext(guildId, connection);
      } else if (queue) {
        queue.playing = false;
        queue.current = null;
      }
    });

    queueMap.set(guildId, {
      tracks: [],
      current: null,
      playing: false,
      player,
      loopMode: 'off', // off | track | queue
      seekOffset: 0, // seconds already seeked into current track
      playbackStartMs: null, // Date.now() when current resource started
      isSeeking: false
    });
  }
  return queueMap.get(guildId);
}

/**
 * Ensures Voice Connection is properly initialized.
 */
async function ensureVoiceConnection(connection) {
  try {
    // Removed numeric separator (15_000 -> 15000) for strict parsers
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    return connection;
  } catch (err) {
    console.error('[Voice Error] Failed to reach Ready state within 20 seconds:', err);
    connection.destroy();
    throw new Error('Voice connection timeout.');
  }
}

/**
 * Play next track in current queue.
 */
async function playNext(guildId, connection) {
  const queue = getQueue(guildId);

  if (queue.tracks.length === 0) {
    queue.playing = false;
    queue.current = null;
    return;
  }

  const track = queue.tracks.shift();
  queue.current = track;
  queue.playing = true;
  queue.seekOffset = 0;
  queue.playbackStartMs = Date.now();
  queue.isSeeking = false;

  try {
    const resource = await createDriveAudioResource(track.requesterDiscordId, track.id, { retries: 2, seek: 0 });
    connection.subscribe(queue.player);
    queue.player.play(resource);
  } catch (err) {
    console.error(`[Playback Error] Failed to stream file ${track.id}:`, err.message);
    if (queue.tracks.length > 0) {
      await playNext(guildId, connection);
    } else {
      queue.playing = false;
      queue.current = null;
    }
  }
}

// 4. Client Event Listeners

function logVoiceStateTransitions(connection, guildId) {
  const states = [
    VoiceConnectionStatus.Connecting,
    VoiceConnectionStatus.Authenticating,
    VoiceConnectionStatus.Ready,
    VoiceConnectionStatus.Disconnected,
    VoiceConnectionStatus.Destroyed
  ];
  for (const state of states) {
    connection.on(state, () => console.log(`[Voice] guild ${guildId} -> ${state}`));
  }
  connection.on('stateChange', (oldState, newState) => {
    const nwOld = oldState.networking?.state?.status || 'none';
    const nwNew = newState.networking?.state?.status || 'none';
    if (nwOld !== nwNew || newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Ready) {
      console.log(`[Voice] guild ${guildId} [${oldState.status}->${newState.status}] networking: ${nwOld} -> ${nwNew}`);
    }
  });
  connection.on('debug', (msg) => {
    if (msg && /ip discovery|session description|endpoint|^<<|^>>|voice|endpoint|ws/.test(String(msg))) {
      console.log(`[Voice:net] guild ${guildId}: ${msg}`);
    }
  });
  // Log the voice endpoint when we get it
  connection.on(VoiceConnectionStatus.Signalling, () => {
    try {
      const ep = connection.joinConfig?.endpoint;
      if (ep) console.log(`[Voice:ep] guild ${guildId} voice endpoint: ${ep}`);
    } catch {}
  });
  connection.on('error', err => console.error(`[Voice] guild ${guildId} error:`, err.message || err));
}
client.once('clientReady', () => {
  console.log(`[Discord Bot] Logged in as ${client.user.tag}`);
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const guildId = oldState.guild?.id || newState.guild?.id;
  if (!guildId) return;

  // Bot itself left / was disconnected / moved — clean up or re-evaluate
  if (newState.member?.id === client.user.id || oldState.member?.id === client.user.id) {
    if (!newState.channelId) {
      // Bot left voice entirely
      cancelEmptyChannelDisconnect(guildId);
      const q = queueMap.get(guildId);
      if (q) {
        q.tracks = [];
        q.current = null;
        q.playing = false;
        q.loopMode = 'off';
        q.seekOffset = 0;
        q.playbackStartMs = null;
        q.isSeeking = false;
        try { q.player.stop(true); } catch {}
      }
      console.log(`[Auto-Disconnect] Bot disconnected from voice — cleared queue for guild ${guildId}`);
      return;
    }
    // Bot moved channels — re-evaluate emptiness of new channel
    if (newState.channelId !== oldState.channelId) {
      cancelEmptyChannelDisconnect(guildId);
      await handleEmptyChannelState(guildId);
      return;
    }
  }

  // Any member join/leave/mute in the bot's channel — check if channel is now empty
  const connection = getVoiceConnection(guildId);
  if (!connection) return;
  const botChannelId = connection.joinConfig?.channelId;
  // Only care if the update is for the bot's current voice channel
  if (oldState.channelId !== botChannelId && newState.channelId !== botChannelId) return;
  await handleEmptyChannelState(guildId);
});

/**
 * Formats a Drive file list into numbered lines that fit in a Discord message.
 */
function formatFileList(files, charBudget = 1800) {
  const lines = [];
  let totalChars = 0;
  for (let i = 0; i < files.length; i++) {
    const line = `${i + 1}. ${files[i].name}`;
    if (totalChars + line.length + 1 > charBudget && lines.length > 0) break;
    lines.push(line);
    totalChars += line.length + 1;
  }
  const omitted = files.length - lines.length;
  if (omitted > 0) lines.push(`... and ${omitted} more`);
  return lines.join('\n');
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stripExtension(name) {
  return name.replace(/\.[^/.]+$/, '');
}

function formatQueue(queue, page = 1, perPage = 10) {
  const lines = [];
  if (queue.current) {
    lines.push(`▶️ **Now Playing:** ${queue.current.name}`);
  } else {
    lines.push('⏹️ Nothing is playing right now.');
  }
  if (queue.loopMode && queue.loopMode !== 'off') {
    lines.push(`🔁 Loop: **${queue.loopMode}** (use \`/loop mode:off\` to disable)`);
  }
  if (queue.tracks.length === 0) {
    lines.push('📭 Queue is empty.');
    return lines.join('\n');
  }
  const totalPages = Math.max(1, Math.ceil(queue.tracks.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  const end = Math.min(start + perPage, queue.tracks.length);
  lines.push(`\n📜 **Queue (${queue.tracks.length} track${queue.tracks.length === 1 ? '' : 's'} — page ${safePage}/${totalPages}):**`);
  for (let i = start; i < end; i++) {
    lines.push(`\`${i + 1}.\` ${queue.tracks[i].name}`);
  }
  if (totalPages > 1) {
    lines.push(`\nUse \`/queue page:${safePage < totalPages ? safePage + 1 : 1}\` for more.`);
  }
  return lines.join('\n');
}

function buildHelpEmbed(requestedCommand) {
  const allGuides = {
    play: {
      title: '🎶 /play',
      desc: 'Search & play music from your Google Drive — now with shuffle, count and **replay/loop** inside.',
      usage: '`/play query:<song> [shuffle:true] [count:1-25] [repeat:1-10] [loop:true] [replay:true]`',
      params: [
        '`query` (required, autocomplete) — Song title/artist. Pick from dropdown or type a Drive file ID. If you type free text and no exact file is found, SPire searches Drive for matching audio files.',
        '`shuffle` / `random` (optional, boolean, default `false`) — When `true`, randomizes/shuffles the songs being queued. Alias `random` does the same as `shuffle` (your `rand`).',
        '`count` / `limit` (optional, integer 1-25, default `1`) — Number of matching songs to queue. `1` = queue the selected song only. `>1` = SPire searches Drive for up to `count` audio files matching the song name / search term and queues them (shuffled if `shuffle:true`).',
        '`repeat` (optional, integer 1-10, default `1`) — **Replay within /play**: queue the same track(s) N times. `repeat:3` with a single song queues it 3× back-to-back. With `count:5` + `repeat:2` you get 10 tracks (5 ×2).',
        '`loop` / `replay` (optional, boolean, default `false`) — **Loop/replay toggle inside /play**. `loop:true` or `replay:true` enables persistent loop right after queuing: single track → `track` loop, multiple tracks → `queue` loop. Use `/loop off` to disable, or `/stop` which also clears loop.',
      ],
      examples: [
        '`/play query:Bohemian Rhapsody` — queue that one track',
        '`/play query:lofi shuffle:true count:5` — queue 5 matching lofi tracks in random order',
        '`/play query:abc123_id random:true limit:10` — alias params work the same',
        '`/play query:lofi repeat:3` — replay/queue same lofi song 3 times',
        '`/play query:My Song loop:true` — queue and enable track replay loop (same song repeats infinitely until `/loop off`)',
        '`/play query:chill count:5 shuffle:true loop:true` — queue 5 shuffled chill tracks and enable queue-loop replay',
        '`/play query:song replay:true repeat:2` — replay alias for loop + duplicate twice',
      ]
    },
    playlist: {
      title: '📂 /playlist',
      desc: 'Play all tracks from a Google Drive folder (playlist).',
      usage: '`/playlist name:<folder> [shuffle:true] [limit:1-100]`',
      params: [
        '`name` (required, autocomplete) — Folder/playlist name from your Drive.',
        '`shuffle` / `random` (optional, boolean) — Shuffle the folder contents before queuing.',
        '`limit` / `count` (optional, integer 1-100, default all) — Only queue the first N tracks after optional shuffling.',
      ],
      examples: [
        '`/playlist name:My Fav Songs` — queue entire folder in order',
        '`/playlist name:Chill shuffle:true limit:10` — queue 10 random tracks from the folder',
      ]
    },
    playlists: {
      title: '📂 /playlists',
      desc: 'List your Drive folders (playlists).',
      usage: '`/playlists`',
      examples: ['`/playlists` — shows up to 100 folders, use `/playlist` to play one']
    },
    songs: {
      title: '🎵 /songs',
      desc: 'List audio files in your music library.',
      usage: '`/songs [count:1-1000]`',
      params: ['`count` (optional) — How many to show (default 100, max 1000).'],
      examples: ['`/songs`', '`/songs count:50`']
    },
    queue: {
      title: '📜 /queue',
      desc: 'Show current queue and now-playing track.',
      usage: '`/queue [page:1]`',
      params: ['`page` (optional) — Page number, 10 tracks per page.'],
      examples: ['`/queue`', '`/queue page:2`']
    },
    skip: {
      title: '⏭️ /skip',
      desc: 'Skip the current track (or multiple).',
      usage: '`/skip [count:1-10]`',
      params: ['`count` (optional, default 1) — Number of tracks to skip.'],
      examples: ['`/skip`', '`/skip count:3` — skip 3 tracks']
    },
    seek: {
      title: '⏩ /seek — 10 sec back & forth',
      desc: 'Seek forward or backward in the current track. 10 sec is the default (back & forth working).',
      usage: '`/seek [seconds: -300 to 300] [time: -300 to 300]`',
      params: [
        '`seconds` (optional, integer -300..300, default `10`) — Seconds to seek. Positive = forward 10s, negative = backward 10s. e.g. `10` forward 10s, `-10` back 10s.',
        '`time` (optional, alias for `seconds`) — Same as `seconds`, use either. e.g. `/seek time:10` or `/seek time:-10`.',
        'Requires a track playing in voice — shows new position like `1:23` after seek.',
        'Clamped 0..300s forward, no negative final position (stops at 0).'
      ],
      examples: [
        '`/seek` — forward 10s (default)',
        '`/seek seconds:10` — forward 10 seconds',
        '`/seek seconds:-10` — backward 10 seconds (rewind)',
        '`/seek time:30` — forward 30s',
        '`/seek time:-30` — back 30s',
        '`/seek seconds:60` — jump forward 1 minute'
      ]
    },
    shuffle: {
      title: '🔀 /shuffle',
      desc: 'Shuffle/randomize the current queue order (Fisher-Yates). Does not affect the now-playing track.',
      usage: '`/shuffle`',
      examples: ['`/shuffle` — queue order is randomized immediately']
    },
    nowplaying: {
      title: '🎧 /nowplaying',
      desc: 'Show details of the currently playing track.',
      usage: '`/nowplaying`',
      examples: ['`/nowplaying`']
    },
    replay: {
      title: '🔁 /replay',
      desc: 'Replay/restart the currently playing track from the beginning (instant). Works even if loop is off.',
      usage: '`/replay`',
      params: ['No params — replays `Now Playing`. If nothing is playing, shows queue.'],
      examples: ['`/replay` — current song restarts instantly', '`/play query:song replay:true` — enable replay within /play (loop inside /play)']
    },
    loop: {
      title: '🔂 /loop',
      desc: 'Toggle or set persistent loop/replay mode. Loops the current track or the whole queue infinitely until turned off.',
      usage: '`/loop [mode: off | track | queue]`',
      params: [
        '`mode` (optional, string, default `track` when omitted) — `track` = replay current song forever, `queue` = replay whole queue (finished track goes to end), `off` = disable loop.',
        'Calling `/loop` with no mode toggles: `off`→`track`, `track`→`queue`, `queue`→`off`.',
        'You can also enable loop directly inside `/play` via `loop:true` or `replay:true`.',
      ],
      examples: [
        '`/loop` — toggle loop mode',
        '`/loop mode:track` — enable track replay loop',
        '`/loop mode:queue` — enable queue replay loop',
        '`/loop mode:off` — disable all replay/loop',
        '`/play query:song loop:true` — queue and instantly enable loop (replay within /play)',
      ]
    },
    pause: { title: '⏸️ /pause', desc: 'Pause current playback.', usage: '`/pause`', examples: ['`/pause`'] },
    resume: { title: '▶️ /resume', desc: 'Resume paused playback.', usage: '`/resume`', examples: ['`/resume`'] },
    stop: { title: '⏹️ /stop', desc: 'Stop playback, clear queue and leave voice (also disables loop).', usage: '`/stop`', examples: ['`/stop`'] },
    link: { title: '🔗 /link', desc: 'Generate a code to link your Discord to SPire (5-min expiry, 30s cooldown).', usage: '`/link`', examples: ['`/link` then paste code at `WEB_APP_URL/settings`'] },
    login: { title: '🔐 /login', desc: 'Get a button linking to SPire Settings to connect Google Drive.', usage: '`/login`', examples: ['`/login`'] },
  };

  if (requestedCommand && allGuides[requestedCommand]) {
    const g = allGuides[requestedCommand];
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(g.title)
      .setDescription(g.desc);
    const fields = [{ name: 'Usage', value: g.usage }];
    if (g.params) {
      const raw = g.params.map(p => `• ${p}`).join('\n');
      // Split if >1024 (Discord field limit)
      if (raw.length <= 1024) {
        fields.push({ name: 'Parameters', value: raw });
      } else {
        let chunk = '';
        let idx = 1;
        for (const p of g.params) {
          const line = `• ${p}\n`;
          if (chunk.length + line.length > 1000) {
            fields.push({ name: idx === 1 ? 'Parameters' : `Parameters (${idx})`, value: chunk.trim() });
            chunk = line;
            idx++;
          } else {
            chunk += line;
          }
        }
        if (chunk) fields.push({ name: fields.length === 1 ? 'Parameters' : `Parameters (${idx})`, value: chunk.trim() });
      }
    }
    const exRaw = g.examples.map(e => `• ${e}`).join('\n');
    if (exRaw.length <= 1024) {
      fields.push({ name: 'Examples', value: exRaw });
    } else {
      // chunk examples similarly
      let chunk = '';
      let idx = 1;
      fields.push({ name: 'Examples', value: '' }); // placeholder to keep order, will replace
      // simple truncate if too long (examples for loop are short, but handle)
      fields[fields.length - 1].value = exRaw.slice(0, 1020) + (exRaw.length > 1024 ? '…' : '');
    }
    embed.addFields(...fields);
    embed.setFooter({ text: 'Tip: Use /help without args to see all commands.' });
    return { embeds: [embed] };
  }

  // Full overview
  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('📖 SPire Bot — Command Guide')
    .setDescription('All slash commands. Most playback commands require you to be in a voice channel.')
    .addFields(
      { name: '🎶 Playback — /play now has replay inside + 10s seek', value: [
        '`/play query:<song> [shuffle] [count] [repeat] [loop] [replay]` — Play a track; `shuffle:true` randomizes, `count:N` queues N matches (1-25), `repeat:N` replays same songs N× (1-10), `loop:true`/`replay:true` enables persistent replay/loop (track or queue).',
        '`/playlist name:<folder> [shuffle] [limit]` — Play a Drive folder; shuffle & limit supported.',
        '`/pause` — Pause  •  `/resume` — Resume  •  `/stop` — Stop & leave (also clears loop)',
        '`/skip [count]` — Skip N tracks  •  `/seek [seconds] [time]` — Seek 10s back & forth (e.g. `10` forward, `-10` backward, `30` forward 30s)  •  `/shuffle` — Shuffle queue  •  `/nowplaying` — Current track',
        '`/queue [page]` — Show queue (10 per page)  •  `/replay` — Instant replay/restart current  •  `/loop [mode]` — Toggle replay loop (off/track/queue)',
      ].join('\n') },
      { name: '📂 Library', value: [
        '`/playlists` — List your Drive folders/playlists',
        '`/songs [count]` — List audio files (default 100, max 1000)',
      ].join('\n') },
      { name: '🔗 Account', value: [
        '`/link` — Generate 8-char code (5-min expiry) to link Discord → SPire',
        '`/login` — Button to open SPire Settings & connect Google Drive',
        '`/help [command]` — This guide; pass a command name for detailed help (e.g. `/help command:play` or `/help command:loop`)',
      ].join('\n') },
      { name: '💡 /play Tips — shuffle + count + replay + seek', value: [
        '• `shuffle` and `random` are aliases — either enables shuffling (`rand` → `shuffle:true`).',
        '• `count` and `limit` are aliases (1-25). With `count>1`, SPire searches Drive for songs matching your query/name and queues up to N results.',
        '• `repeat:3` — **replay within /play**: queues the same track(s) 3× (e.g. `/play query:MySong repeat:5` loops it 5 times via queue).',
        '• `loop:true` / `replay:true` — **replay/loop inside /play**: enables infinite loop (track for single, queue for multiple). Use `/loop off` or `/stop` to disable.',
        '• Pick from autocomplete for exact match, or type a search term for broader results.',
        '• Use `/play query:lofi shuffle:true count:5 repeat:2 loop:true` for 10 shuffled tracks with queue-loop replay.',
        '• Quick replay: `/replay` restarts current song instantly without re-queuing.',
        '• **Seek 10s back & forth**: `/seek` forward 10s, `/seek seconds:-10` back 10s, `/seek time:30` forward 30s — works while playing.',
      ].join('\n') }
    )
    .setFooter({ text: 'Need help with one command? Try /help command:play or /help command:loop' });
  return { embeds: [embed] };
}

client.on('interactionCreate', async interaction => {
  const discordId = interaction.user.id;

  // Autocomplete Handler
  if (interaction.isAutocomplete()) {
    const focusedValue = interaction.options.getFocused();
    const commandName = interaction.commandName;

    if (!focusedValue || focusedValue.trim().length === 0) {
      return interaction.respond([]);
    }

    // Serve repeated/identical queries from cache so the dropdown stays snappy
    // while the user types (avoids per-keystroke Drive API round-trips).
    const cacheKey = `${discordId}:${commandName}:${focusedValue.trim().toLowerCase()}`;
    const cachedChoices = autocompleteCache.get(cacheKey);
    if (cachedChoices && cachedChoices.expiresAt > Date.now()) {
      return interaction.respond(cachedChoices.choices).catch(() => {});
    }

    try {
      const accessToken = await getValidAccessToken(discordId);
      let data;

      if (commandName === 'playlist') {
        const query = buildDriveQuery(focusedValue, 'application/vnd.google-apps.folder');
        data = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=5`);
      } else {
        const query = buildDriveQuery(focusedValue, 'audio/');
        data = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=5`);
      }

      const choices = (data.files || []).map(file => ({
        name: file.name.length > 100 ? file.name.substring(0, 97) + '...' : file.name,
        value: file.id
      }));

      autocompleteCache.set(cacheKey, { choices, expiresAt: Date.now() + 10000 });
      if (autocompleteCache.size > 300) {
        const oldest = autocompleteCache.keys().next().value;
        if (oldest !== undefined) autocompleteCache.delete(oldest);
      }

      await interaction.respond(choices);
    } catch (err) {
      console.error('[Autocomplete Error]:', err.message);
      await interaction.respond([]).catch(() => {});
    }
    return;
  }

  // Chat Input Commands Handler
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, member } = interaction;
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel && !VOICE_EXEMPT_COMMANDS.has(commandName)) {
    return interaction.reply({ content: '❌ You must be connected to a voice channel to use this command.', flags: MessageFlags.Ephemeral });
  }

  // Defer BEFORE any blocking work. Voice join (entersState 15s) and Supabase (cold start)
  // will both exceed Discord's 3s acknowledgement window if we await them first.
  // /link must also defer before voice check, otherwise `ensureVoiceConnection` blocks `deferReply` at 444.
  const DEFER_COMMANDS = new Set(['play', 'playlist', 'link', 'playlists', 'songs', 'queue', 'skip', 'replay', 'seek']);
  if (DEFER_COMMANDS.has(commandName) && !interaction.deferred && !interaction.replied) {
    // help/queue/nowplaying/loop are fast but defer queue/skip/replay/play for Drive/search work
    const ephemeral = commandName === 'link';
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : undefined);
  }

  let connection = getVoiceConnection(guildId);
  // VOICE_EXEMPT commands (link/login/stop/launch/playlists/songs) must NEVER block on voice join.
  // Before joining, check permissions so users get a clear error instead of a silent 15s timeout.
  const needsVoice = !VOICE_EXEMPT_COMMANDS.has(commandName);
  if (needsVoice && !connection && voiceChannel) {
    const botMember = interaction.guild.members.me;
    const missingPerms = ['Connect', 'Speak'].filter(perm => !voiceChannel.permissionsFor(botMember)?.has(perm));
    if (missingPerms.length > 0) {
      const msg = `❌ I need **${missingPerms.join(' and ')}** permission in **#${voiceChannel.name}**.`;
      return interaction.deferred
        ? interaction.editReply(msg)
        : interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }

    // Join with one retry — transient gateway/region hiccups recover on attempt 2.
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: true
        });
        logVoiceStateTransitions(connection, guildId);

        await ensureVoiceConnection(connection);
        // Bot is now in a channel with at least the requester — ensure empty-channel timer is cleared
        cancelEmptyChannelDisconnect(guildId);
        break;
      } catch (_err) {
        lastError = _err;
        console.error(`[Voice Error] Join attempt ${attempt}/2 failed:`, _err?.message || _err);
        if (connection) {
          try { connection.destroy(); } catch {}
          connection = null;
        }
      }
    }

    if (!connection) {
      const isTimeout = /timeout/i.test(String(lastError?.message || ''));
      const hint = isTimeout
        ? ' Check the terminal logs for the [Voice] states — if it stops at "connecting", Discord voice (UDP) is blocked on this network (VPN, firewall, or a second bot instance still running).'
        : '';
      const errorMsg = `❌ Failed to establish voice channel connection.${hint}`;
      return interaction.deferred
        ? interaction.editReply(errorMsg)
        : interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
    }
  } else if (connection && needsVoice) {
    // Already connected — re-evaluate empty state (e.g. user rejoined before command)
    cancelEmptyChannelDisconnect(guildId);
  } else if (!needsVoice) {
    // For exempt commands, just read existing connection for /stop use, don't join/create
    // connection already fetched via getVoiceConnection above
  }

  const queue = getQueue(guildId);

  // Command: /play — enhanced with shuffle/rand, count/limit, replay/loop/repeat
  if (commandName === 'play') {
    const rawQuery = interaction.options.getString('query');
    const shuffleOpt = interaction.options.getBoolean('shuffle') ?? false;
    const randomOpt = interaction.options.getBoolean('random') ?? false;
    const shouldShuffle = Boolean(shuffleOpt || randomOpt);
    const countOpt = interaction.options.getInteger('count');
    const limitOpt = interaction.options.getInteger('limit');
    const requestedCount = countOpt ?? limitOpt ?? 1; // 1-25, default 1
    const count = Math.min(Math.max(1, requestedCount), 25);
    // Replay / loop / repeat — new
    const repeatOpt = interaction.options.getInteger('repeat');
    const repeatCount = repeatOpt ? Math.min(Math.max(1, repeatOpt), 10) : 1; // 1-10, 1 = no extra repeat
    const loopOpt = interaction.options.getBoolean('loop');
    const replayOpt = interaction.options.getBoolean('replay');
    // loop/replay: handle explicit true/false. null = not provided (keep existing). true = enable, false = disable.
    const loopProvided = loopOpt !== null || replayOpt !== null;
    const shouldLoop = loopProvided ? Boolean(loopOpt || replayOpt) : null; // null = not touched, true=enable, false=disable

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    try {
      const accessToken = await getValidAccessToken(discordId);

      // Try to resolve rawQuery as a file ID first; on failure treat it as a search term.
      let fileData = null;
      let isFileId = false;
      try {
        fileData = await driveRequest(accessToken, `/drive/v3/files/${rawQuery}?fields=id,name,mimeType`);
        // Only treat as file if mimeType looks like audio or we got a name back; folders should not match /play
        if (fileData && fileData.id) isFileId = true;
      } catch (_) {
        fileData = null;
        isFileId = false;
      }

      let tracks = [];

      if (isFileId && fileData) {
        // Direct file pick via autocomplete
        if (count === 1 && !shouldShuffle) {
          tracks = [{
            id: fileData.id,
            name: fileData.name,
            requesterDiscordId: discordId
          }];
        } else if (count === 1 && shouldShuffle) {
          // Single track but shuffle flag is a no-op for single; still just queue it and note shuffled
          tracks = [{
            id: fileData.id,
            name: fileData.name,
            requesterDiscordId: discordId
          }];
        } else {
          // count > 1 — search for similar tracks using the file's base name as term,
          // queue the selected file + up to count-1 additional matches.
          const base = stripExtension(fileData.name);
          // Prefer first word or full base? Using base gives precise matches; fallback to broader if too few.
          const safeTerm = base.trim().slice(0, 40) || fileData.name;
          const searchQuery = buildDriveQuery(safeTerm, 'audio/');
          let searchData = null;
          try {
            searchData = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)&pageSize=50`);
          } catch (se) {
            console.warn('[Play] Similar search failed, falling back to single:', se.message);
          }
          const candidates = (searchData?.files || []).filter(f => f.id !== fileData.id);
          let extra = candidates;
          if (shouldShuffle) extra = shuffleArray(extra);
          extra = extra.slice(0, Math.max(0, count - 1)).map(f => ({
            id: f.id,
            name: f.name,
            requesterDiscordId: discordId
          }));
          // If not enough similar, fill with random audio files up to count
          if (extra.length < count - 1) {
            try {
              const randQuery = encodeURIComponent(`mimeType contains 'audio/' and trashed = false`);
              const randData = await driveRequest(accessToken, `/drive/v3/files?q=${randQuery}&fields=files(id,name)&pageSize=50&orderBy=name`);
              const pool = (randData.files || []).filter(f => f.id !== fileData.id && !extra.some(e => e.id === f.id));
              const shuffledPool = shouldShuffle ? shuffleArray(pool) : pool;
              const need = (count - 1) - extra.length;
              extra.push(...shuffledPool.slice(0, need).map(f => ({ id: f.id, name: f.name, requesterDiscordId: discordId })));
            } catch {}
          }
          const primary = { id: fileData.id, name: fileData.name, requesterDiscordId: discordId };
          tracks = shouldShuffle ? shuffleArray([primary, ...extra]) : [primary, ...extra];
        }
      } else {
        // Treat rawQuery as search term — find up to `count` matching audio files
        const term = rawQuery.trim();
        const searchQuery = buildDriveQuery(term, 'audio/');
        const data = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)&pageSize=${Math.max(count, 5)}`);
        let files = data.files || [];
        if (files.length === 0) {
          return interaction.editReply(`❌ No audio files found matching **"${term}"**. Try a different search or pick from autocomplete.`);
        }
        if (shouldShuffle) files = shuffleArray(files);
        files = files.slice(0, count);
        tracks = files.map(f => ({ id: f.id, name: f.name, requesterDiscordId: discordId }));
      }

      if (tracks.length === 0) {
        return interaction.editReply('❌ Could not find any tracks to queue.');
      }

      // Handle repeat — duplicate tracks N times for replay
      if (repeatCount > 1) {
        const original = [...tracks];
        for (let r = 1; r < repeatCount; r++) {
          // clone to avoid reference sharing of object IDs (but same fileId is fine)
          tracks.push(...original.map(t => ({ ...t })));
        }
      }

      // Handle persistent loop/replay — sets guild loopMode if loop/replay was explicitly provided
      if (loopProvided) {
        if (shouldLoop) {
          // If queuing multiple tracks, loop the queue; single track -> loop track
          queue.loopMode = tracks.length > 1 ? 'queue' : 'track';
        } else {
          queue.loopMode = 'off';
        }
      }

      queue.tracks.push(...tracks);

      if (!queue.playing && connection) {
        await playNext(guildId, connection);
      }

      const shuffleNote = shouldShuffle && tracks.length > 1 ? ' 🔀 shuffled' : '';
      const repeatNote = repeatCount > 1 ? ` 🔁 replay ×${repeatCount}` : '';
      let loopNote = '';
      if (loopProvided) {
        loopNote = shouldLoop ? ` (🔁 loop: ${queue.loopMode})` : ` (🔁 loop disabled)`;
      } else if (queue.loopMode !== 'off') {
        loopNote = ` (🔁 loop ${queue.loopMode} on)`;
      }
      const header = tracks.length === 1 && repeatCount === 1
        ? `🎶 Added to queue: **${tracks[0].name}**${loopNote}`
        : `🎶 Added **${tracks.length} track${tracks.length === 1 ? '' : 's'}** to queue${shuffleNote}${repeatNote}${loopNote}:`;
      const list = tracks.length === 1 && repeatCount === 1 ? '' : `\n\`\`\`\n${formatFileList(tracks)}\n\`\`\``;
      const footer = tracks.length > 1 ? `\nUse \`/queue\` to view queue • \`/shuffle\` to randomize • \`/loop off\` to disable loop • \`/replay\` to replay current` : (shouldLoop === true || (shouldLoop === null && queue.loopMode !== 'off') ? `\n🔁 Loop ${queue.loopMode} enabled — use \`/loop off\` to disable or \`/replay\` to restart` : (shouldLoop === false ? '\n🔁 Loop disabled.' : ''));
      const msg = header + list + footer;
      return interaction.editReply(msg);
    } catch (err) {
      console.error('[Play Error]:', err.message);
      const msg = '❌ Could not stream track(s). Connect your Google Drive in SPire Web App settings first.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
    }
    return;
  }

  // Command: /pause
  if (commandName === 'pause') {
    if (queue.playing) {
      // Freeze seek position on pause
      if (queue.playbackStartMs) {
        const elapsed = (Date.now() - queue.playbackStartMs) / 1000;
        queue.seekOffset = (queue.seekOffset || 0) + elapsed;
        queue.playbackStartMs = null;
      }
      queue.player.pause();
      queue.playing = false;
      await interaction.reply('⏸️ Playback paused.');
    } else {
      await interaction.reply({ content: 'Nothing is currently playing.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // Command: /resume
  if (commandName === 'resume') {
    if (!queue.playing && queue.current) {
      queue.player.unpause();
      queue.playing = true;
      queue.playbackStartMs = Date.now();
      await interaction.reply('▶️ Playback resumed.');
    } else {
      await interaction.reply({ content: 'No paused track to resume.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // Command: /stop
  if (commandName === 'stop') {
    cancelEmptyChannelDisconnect(guildId);
    queue.loopMode = 'off';
    queue.seekOffset = 0;
    queue.playbackStartMs = null;
    queue.isSeeking = false;
    if (connection) {
      queue.player.stop(true);
      queue.tracks = [];
      queue.current = null;
      queue.playing = false;
      try { connection.destroy(); } catch {}
      await interaction.reply('⏹️ Stopped playback, cleared queue, disabled loop, and left the voice channel.');
    } else {
      // Also clear queue even if not connected (stale state)
      queue.tracks = [];
      queue.current = null;
      queue.playing = false;
      await interaction.reply({ content: 'Not connected to a voice channel.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // Command: /login
  if (commandName === 'login') {
    const button = new ButtonBuilder()
      .setLabel('Connect Google Drive')
      .setStyle(ButtonStyle.Link)
      .setURL(`${WEB_APP_URL}/settings`);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
      content: 'Click below to connect your Google Drive account to SPire:',
      components: [row],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // Command: /link
  if (commandName === 'link') {
    // Already deferred at bot/index.js:310 before voice block to avoid "did not respond".
    // Keep guard for direct invocation / tests.
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
      // 2. NOW do heavy lifting AFTER defer (rate-limit, Supabase ops, code gen)
      const now = Date.now();
      const lastRequest = linkRateLimit.get(discordId);
      if (lastRequest && now - lastRequest < 30000) {
        const waitSeconds = Math.ceil((30000 - (now - lastRequest)) / 1000);
        return interaction.editReply(`⏳ Please wait ${waitSeconds}s before generating another verification code.`);
      }
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?discord_id=eq.${discordId}&select=id`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY
        }
      });
      const linkedUser = await checkRes.json().catch(() => []);
      if (Array.isArray(linkedUser) && linkedUser.length > 0) {
        return interaction.editReply('✅ Your Discord account is already linked to SPire.');
      }

      let code = null;
      let inserted = false;

      // Clear any prior unredeemed code FIRST. linking_codes has a UNIQUE
      // index on discord_id (idx_linking_codes_discord_id_active), so the
      // insert below would 23505 if a previous row still exists.
      await fetch(`${SUPABASE_URL}/rest/v1/linking_codes?discord_id=eq.${discordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY
        }
      }).catch(() => {});

      for (let attempt = 0; attempt < 5; attempt++) {
        code = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/linking_codes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ code, discord_id: discordId, expires_at: expiresAt })
        });

        if (insertRes.ok) {
          inserted = true;
          break;
        } else {
          const insertErr = await insertRes.text().catch(() => '');
          console.error("Supabase Insert Error:", `attempt ${attempt + 1}/5`, `status ${insertRes.status}`, insertErr || '(empty body)');
        }
      }

      if (!inserted || !code) {
        console.error("Supabase Insert Error:", 'all 5 insert attempts failed — verify SUPABASE_SERVICE_ROLE_KEY and linking_codes RLS/service_role grant');
        return interaction.editReply('❌ Failed to generate unique code. Please try again.');
      }

      linkRateLimit.set(discordId, Date.now());
      const cleanUrl = WEB_APP_URL.replace(/^https?:\/\//, '');
      return interaction.editReply(`Your verification code is **\`${code}\`**.\n\nIt will expire in 5 minutes. Enter this code on **${cleanUrl}/settings** under the Discord section.`, { flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error("Supabase Insert Error:", err);
      console.error('[Link Command Error]:', err?.message || err, err?.stack || '');
      // Already deferred at top, so always editReply (never reply/deferReply again)
      return interaction.editReply('❌ Failed to generate unique code. Please check server logs.');
    }
    // No extra return needed — editReply already returned in all branches
  }

  // Command: /playlist — enhanced with shuffle/rand and limit/count
  if (commandName === 'playlist') {
    const folderId = interaction.options.getString('name');
    const shuffleOpt = interaction.options.getBoolean('shuffle') ?? false;
    const randomOpt = interaction.options.getBoolean('random') ?? false;
    const shouldShuffle = Boolean(shuffleOpt || randomOpt);
    const limitOpt = interaction.options.getInteger('limit');
    const countOpt = interaction.options.getInteger('count');
    const requestedLimit = limitOpt ?? countOpt ?? 0; // 0 = no limit (all)

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    try {
      const accessToken = await getValidAccessToken(discordId);
      const folderData = await driveRequest(accessToken, `/drive/v3/files/${folderId}?fields=id,name`);
      const query = `'${folderId}' in parents and mimeType contains 'audio/' and trashed = false`;
      const filesData = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=100`);

      let files = filesData.files || [];
      if (files.length === 0) {
        return interaction.editReply('📂 Selected folder is empty or contains no supported audio files.');
      }

      if (shouldShuffle) {
        files = shuffleArray(files);
      }

      if (requestedLimit > 0) {
        const lim = Math.min(Math.max(1, requestedLimit), 100);
        files = files.slice(0, lim);
      }

      const tracks = files.map(file => ({
        id: file.id,
        name: file.name,
        requesterDiscordId: discordId
      }));

      queue.tracks.push(...tracks);

      if (!queue.playing && connection) {
        await playNext(guildId, connection);
      }

      const shuffleNote = shouldShuffle ? ' 🔀 shuffled' : '';
      const limitNote = requestedLimit > 0 ? ` (limited to ${tracks.length})` : '';
      const msg = `🎶 Added **${tracks.length} track${tracks.length === 1 ? '' : 's'}** from **"${folderData.name}"** folder to queue${shuffleNote}${limitNote}.\n\`\`\`\n${formatFileList(tracks)}\n\`\`\``;
      return interaction.editReply(msg);
    } catch (err) {
      console.error('[Playlist Error]:', err.message);
      const msg = '❌ Failed to load playlist. Connect your Google Drive in SPire Web App settings first.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
    }
    return;
  }

  // Command: /playlists — list the user's Drive music folders (playlist names)
  if (commandName === 'playlists') {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    try {
      const accessToken = await getValidAccessToken(discordId);
      const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and trashed = false`);
      const data = await driveRequest(accessToken, `/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=100&orderBy=name`);
      const folders = data.files || [];

      if (folders.length === 0) {
        return interaction.editReply('📂 No playlists (folders) found in your Google Drive.');
      }

      const list = formatFileList(folders);
      const suffix = folders.length > 1 ? 's' : '';
      return interaction.editReply(`📂 **Your Playlist${suffix} (${folders.length})**\n\`\`\`\n${list}\n\`\`\`Use **/playlist <name>** to play one.`);
    } catch (err) {
      console.error('[Playlists Error]:', err.message);
      return interaction.editReply('❌ Could not load playlists. Connect your Google Drive in SPire settings first.');
    }
  }

  // Command: /songs — list songs from the user's Drive music library.
  // Optional "count" limits how many are shown (default: all, capped at 100).
  if (commandName === 'songs') {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    try {
      const requested = interaction.options.getInteger('count') || 0;
      const pageSize = requested > 0 ? Math.min(requested, 1000) : 100;
      const accessToken = await getValidAccessToken(discordId);
      const query = encodeURIComponent(`mimeType contains 'audio/' and trashed = false`);
      const data = await driveRequest(accessToken, `/drive/v3/files?q=${query}&fields=nextPageToken,files(id,name)&pageSize=${pageSize}&orderBy=name`);
      const files = data.files || [];
      const hasMore = Boolean(data.nextPageToken) && files.length === pageSize;

      if (files.length === 0) {
        return interaction.editReply('🎵 No audio files found in your Google Drive music library.');
      }

      const shown = files.length;
      const header = `🎵 **Your Music Library** — showing ${shown}${requested > 0 ? ` of at least ${shown}` : ''}`;
      const list = formatFileList(files);
      const footer = hasMore ? `\n… more songs exist. Run **/songs <number>** to list up to that many (max 1000).` : '\nUse **/play <name>** to play a song.';
      return interaction.editReply(`${header}\n\`\`\`\n${list}\n\`\`\`${footer}`);
    } catch (err) {
      console.error('[Songs Error]:', err.message);
      return interaction.editReply('❌ Could not load your music library. Connect your Google Drive in SPire settings first.');
    }
  }

  // Command: /queue — show current queue
  if (commandName === 'queue') {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
    try {
      const page = interaction.options.getInteger('page') || 1;
      const msg = formatQueue(queue, page, 10);
      return interaction.editReply(msg);
    } catch (err) {
      console.error('[Queue Error]:', err.message);
      return interaction.editReply('❌ Could not load queue.');
    }
  }

  // Command: /skip — skip N tracks
  if (commandName === 'skip') {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
    try {
      const skipCount = interaction.options.getInteger('count') || 1;
      const count = Math.min(Math.max(1, skipCount), 10);
      if (!queue.current && queue.tracks.length === 0) {
        return interaction.editReply('📭 Nothing to skip — queue is empty.');
      }
      // If skipping 1, just stop player to trigger next via Idle. For N>1, drop N-1 from queue then trigger.
      if (count > 1) {
        const drop = Math.min(count - 1, queue.tracks.length);
        queue.tracks.splice(0, drop);
      }
      const skippedName = queue.current ? queue.current.name : null;
      let nextMsg = skippedName ? `⏭️ Skipped **${skippedName}**` : '⏭️ Skipped';
      if (count > 1) nextMsg += ` (**${count}** tracks)`;
      // Trigger next
      if (queue.tracks.length > 0 && connection) {
        // Stop current to play next; player Idle will also call playNext but we force it for immediacy
        try { queue.player.stop(true); } catch {}
        // Give playNext a tick — if player Idle doesn't fire instantly, call manually
        setTimeout(() => {
          if (queue.tracks.length > 0 && !queue.playing) {
            playNext(guildId, connection).catch(e => console.error('[Skip playNext Error]:', e.message));
          }
        }, 200);
        const upNext = queue.tracks[0] ? `\n▶️ Up next: **${queue.tracks[0].name}**` : '';
        return interaction.editReply(nextMsg + upNext);
      } else {
        // No more tracks — just stop
        try { queue.player.stop(true); } catch {}
        queue.current = null;
        queue.playing = false;
        return interaction.editReply(`${nextMsg}\n📭 Queue is now empty.`);
      }
    } catch (err) {
      console.error('[Skip Error]:', err.message);
      return interaction.editReply('❌ Could not skip track.');
    }
  }

  // Command: /seek — seek forward/backward by seconds (default 10s) back and forth
  if (commandName === 'seek') {
    if (!queue.current) {
      return interaction.reply({ content: '⏹️ Nothing is currently playing to seek. Use **/play** to start.', flags: MessageFlags.Ephemeral });
    }
    if (!connection) {
      return interaction.reply({ content: '❌ Not connected to voice. Join a voice channel and use **/play** first.', flags: MessageFlags.Ephemeral });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }
    try {
      const delta = interaction.options.getInteger('seconds') ?? interaction.options.getInteger('time') ?? 10;
      const seconds = Math.max(-300, Math.min(300, delta));
      if (seconds === 0) {
        return interaction.editReply('⚠️ Seek amount is 0 — no change.');
      }
      const elapsed = queue.playbackStartMs ? (Date.now() - queue.playbackStartMs) / 1000 : 0;
      const currentPos = (queue.seekOffset || 0) + elapsed;
      let newPos = currentPos + seconds;
      if (newPos < 0) newPos = 0;
      const direction = seconds > 0 ? 'forward' : 'backward';
      const absSec = Math.abs(seconds);
      queue.isSeeking = true;
      const newResource = await createDriveAudioResource(queue.current.requesterDiscordId, queue.current.id, { retries: 2, seek: Math.floor(newPos) });
      connection.subscribe(queue.player);
      queue.player.play(newResource);
      queue.playing = true;
      queue.seekOffset = newPos;
      queue.playbackStartMs = Date.now();
      setTimeout(() => { queue.isSeeking = false; }, 500);

      const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
      };
      const arrow = seconds > 0 ? '⏩' : '⏪';
      const msg = `${arrow} Seeked **${absSec}s ${direction}** in **${queue.current.name}**\n📍 Now at **${formatTime(newPos)}** (was ${formatTime(currentPos)})`;
      return interaction.editReply(msg);
    } catch (err) {
      queue.isSeeking = false;
      console.error('[Seek Error]:', err.message);
      const msg = '❌ Could not seek. Try again or use **/replay** to restart.';
      if (interaction.deferred || interaction.replied) return interaction.editReply(msg);
      return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }

  // Command: /shuffle — shuffle current queue
  if (commandName === 'shuffle') {
    // This modifies queue order, requires voice channel per VOICE_EXEMPT check
    if (queue.tracks.length < 2) {
      return interaction.reply({ content: '📭 Not enough tracks to shuffle — queue needs at least 2 songs. Add more with **/play** or **/playlist**.', flags: MessageFlags.Ephemeral });
    }
    queue.tracks = shuffleArray(queue.tracks);
    const preview = formatFileList(queue.tracks.slice(0, 10));
    const more = queue.tracks.length > 10 ? `\n... and ${queue.tracks.length - 10} more` : '';
    return interaction.reply(`🔀 Shuffled **${queue.tracks.length}** tracks in queue:\n\`\`\`\n${preview}${more}\n\`\`\``);
  }

  // Command: /nowplaying — show current track (enhanced with loop status)
  if (commandName === 'nowplaying') {
    if (!queue.current) {
      return interaction.reply({ content: '⏹️ Nothing is currently playing. Use **/play** to start playback.', flags: MessageFlags.Ephemeral });
    }
    const loopStr = queue.loopMode !== 'off' ? `🔁 ${queue.loopMode}` : 'Off';
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('🎧 Now Playing')
      .setDescription(`**${queue.current.name}**`)
      .addFields(
        { name: 'Queue', value: `${queue.tracks.length} track${queue.tracks.length === 1 ? '' : 's'} remaining`, inline: true },
        { name: 'Status', value: queue.playing ? '▶️ Playing' : '⏸️ Paused', inline: true },
        { name: 'Loop / Replay', value: loopStr, inline: true }
      )
      .setFooter({ text: 'Use /queue to see full queue • /replay to replay • /loop to toggle loop • /skip to skip' });
    return interaction.reply({ embeds: [embed] });
  }

  // Command: /replay — replay/restart the current track instantly
  if (commandName === 'replay') {
    if (!queue.current) {
      return interaction.reply({ content: '⏹️ Nothing is currently playing to replay. Use **/play** to start.', flags: MessageFlags.Ephemeral });
    }
    // Ensure we have a voice connection to subscribe to
    if (!connection) {
      return interaction.reply({ content: '❌ Not connected to voice. Join a voice channel and use **/play** first.', flags: MessageFlags.Ephemeral });
    }
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
      const resource = await createDriveAudioResource(queue.current.requesterDiscordId, queue.current.id, { retries: 2, seek: 0 });
      connection.subscribe(queue.player);
      queue.player.play(resource);
      queue.playing = true;
      queue.seekOffset = 0;
      queue.playbackStartMs = Date.now();
      const msg = `🔁 Replaying: **${queue.current.name}**${queue.loopMode !== 'off' ? ` (loop ${queue.loopMode} is on)` : ''}`;
      return interaction.editReply(msg);
    } catch (err) {
      console.error('[Replay Error]:', err.message);
      const msg = '❌ Could not replay track. Try again or re-queue with **/play**.';
      if (interaction.deferred || interaction.replied) return interaction.editReply(msg);
      return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }

  // Command: /loop — toggle or set loop/replay mode (off / track / queue)
  if (commandName === 'loop') {
    const modeInput = interaction.options.getString('mode'); // may be null
    let newMode = queue.loopMode;
    if (!modeInput) {
      // Toggle cycle: off -> track -> queue -> off
      if (queue.loopMode === 'off') newMode = 'track';
      else if (queue.loopMode === 'track') newMode = 'queue';
      else newMode = 'off';
    } else {
      const m = modeInput.toLowerCase();
      if (['off', 'none', 'disable', 'disabled'].includes(m)) newMode = 'off';
      else if (['track', 'song', 'single', 'one', 'current', 'replay'].includes(m)) newMode = 'track';
      else if (['queue', 'all', 'playlist'].includes(m)) newMode = 'queue';
      else newMode = 'off';
    }
    queue.loopMode = newMode;
    const icons = { off: '➡️ Loop disabled', track: '🔂 Track loop enabled — current song will replay forever', queue: '🔁 Queue loop enabled — finished songs go to end of queue' };
    const desc = icons[newMode];
    // Show queue status with loop
    if (queue.current) {
      return interaction.reply(`${desc}\n▶️ Now playing: **${queue.current.name}**\nUse \`/loop mode:off\` to disable or \`/replay\` to instantly replay.`);
    }
    return interaction.reply(`${desc}\n📭 Nothing playing yet — loop will apply when you use **/play**.`);
  }

  // Command: /help — guide for all commands, with optional specific command detail
  if (commandName === 'help') {
    const requested = interaction.options.getString('command');
    const helpContent = buildHelpEmbed(requested);
    // Help is ephemeral-friendly but allow public if user wants? Use ephemeral for clutter-free.
    // We'll reply ephemeral so it doesn't spam channel.
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(helpContent);
    }
    return interaction.reply({ ...helpContent, flags: MessageFlags.Ephemeral });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);