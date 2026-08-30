require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const crypto = require('crypto');
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags
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

// 1. Initialize Express Server (For Render Health Checks)
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
const VOICE_EXEMPT_COMMANDS = new Set(['stop', 'login', 'link', 'launch']);

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

/**
 * Queue initialization and handler per Guild.
 */
function getQueue(guildId) {
  if (!queueMap.has(guildId)) {
    const player = createAudioPlayer();

    player.on(AudioPlayerStatus.Idle, async () => {
      const queue = queueMap.get(guildId);
      try {
        if (queue && queue.tracks.length > 0) {
          const connection = getVoiceConnection(guildId);
          if (connection) {
            await playNext(guildId, connection);
          }
        } else if (queue) {
          queue.playing = false;
          queue.current = null;
        }
      } catch (e) {
        console.error(`[Audio Player Idle Error] Guild ${guildId}:`, e.message);
        if (queue) {
          queue.playing = false;
          queue.current = null;
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
      player
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
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    return connection;
  } catch (err) {
    console.error('[Voice Error] Failed to reach Ready state within 15 seconds:', err);
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

  try {
    const resource = await createDriveAudioResource(track.requesterDiscordId, track.id, { retries: 2 });
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

client.on('interactionCreate', async interaction => {
  const discordId = interaction.user.id;

  // Autocomplete Handler
  if (interaction.isAutocomplete()) {
    const focusedValue = interaction.options.getFocused();
    const commandName = interaction.commandName;

    if (!focusedValue || focusedValue.trim().length === 0) {
      return interaction.respond([]);
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
  if ((commandName === 'play' || commandName === 'playlist' || commandName === 'link') && !interaction.deferred && !interaction.replied) {
    await interaction.deferReply(commandName === 'link' ? { flags: MessageFlags.Ephemeral } : undefined);
  }

  let connection = getVoiceConnection(guildId);
  // VOICE_EXEMPT commands (link/login/stop/launch) must NEVER block on voice join.
  // Previous bug: /link with user in voice still did `await ensureVoiceConnection` (4-15s)
  // before reaching `deferReply` at 444 -> Discord timeout -> "application did not respond"
  // + log "Failed to establish voice channel connection" seen in your screenshot.
  const needsVoice = !VOICE_EXEMPT_COMMANDS.has(commandName);
  if (needsVoice && !connection && voiceChannel) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    try {
      await ensureVoiceConnection(connection);
      // Bot is now in a channel with at least the requester — ensure empty-channel timer is cleared
      cancelEmptyChannelDisconnect(guildId);
    } catch (_err) {
      console.error('[Voice Error] Failed to establish connection:', _err);
      const errorMsg = '❌ Failed to establish voice channel connection.';
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

  // Command: /play
  if (commandName === 'play') {
    const fileId = interaction.options.getString('query');
    // Guard: defer only if not already acknowledged (prevents double deferReply crash)
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    try {
      const accessToken = await getValidAccessToken(discordId);
      const fileData = await driveRequest(accessToken, `/drive/v3/files/${fileId}?fields=id,name`);

      queue.tracks.push({
        id: fileData.id,
        name: fileData.name,
        requesterDiscordId: discordId
      });

      if (!queue.playing && connection) {
        await playNext(guildId, connection);
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`🎶 Added to queue: **${fileData.name}**`);
      } else {
        await interaction.reply(`🎶 Added to queue: **${fileData.name}**`);
      }
    } catch (err) {
      console.error('[Play Error]:', err.message);
      const msg = '❌ Could not stream track. Connect your Google Drive account in SPire Web App settings first.';
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
      await interaction.reply('▶️ Playback resumed.');
    } else {
      await interaction.reply({ content: 'No paused track to resume.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  // Command: /stop
  if (commandName === 'stop') {
    cancelEmptyChannelDisconnect(guildId);
    if (connection) {
      queue.player.stop(true);
      queue.tracks = [];
      queue.current = null;
      queue.playing = false;
      try { connection.destroy(); } catch {}
      await interaction.reply('⏹️ Stopped playback, cleared queue, and left the voice channel.');
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

      // Delete old codes ONLY after successful insert, so user always has a valid code
      await fetch(`${SUPABASE_URL}/rest/v1/linking_codes?discord_id=eq.${discordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY
        }
      }).catch(() => {});

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

  // Command: /playlist
  if (commandName === 'playlist') {
    const folderId = interaction.options.getString('name');
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    try {
      const accessToken = await getValidAccessToken(discordId);
      const folderData = await driveRequest(accessToken, `/drive/v3/files/${folderId}?fields=id,name`);
      const query = `'${folderId}' in parents and mimeType contains 'audio/' and trashed = false`;
      const filesData = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=100`);

      const tracks = (filesData.files || []).map(file => ({
        id: file.id,
        name: file.name,
        requesterDiscordId: discordId
      }));

      if (tracks.length === 0) {
        return interaction.editReply('📂 Selected folder is empty or contains no supported audio files.');
      }

      queue.tracks.push(...tracks);

      if (!queue.playing && connection) {
        await playNext(guildId, connection);
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`music Added **${tracks.length} tracks** from **"${folderData.name}"** folder to queue.`);
      } else {
        await interaction.reply(`music Added **${tracks.length} tracks** from **"${folderData.name}"** folder to queue.`);
      }
    } catch (err) {
      console.error('[Playlist Error]:', err.message);
      const msg = ' Failed to load playlist. Connect your Google Drive in SPire Web App settings first.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
    }
    return;
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);