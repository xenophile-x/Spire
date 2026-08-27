require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');
const { getValidAccessToken, driveRequest, createDriveAudioResource, escapeDriveQuery } = require('./driveStream');

const app = express();
app.get('/health', (_, res) => res.send('OK'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Health server on ${PORT}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const queue = new Map();
const linkRateLimit = new Map(); // discordId -> timestamp, 30s window
const VOICE_EXEMPT = new Set(['stop', 'login', 'link']);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://spire-wheat-ten.vercel.app';

function getQueue(guildId) {
  if (!queue.has(guildId)) {
    const player = createAudioPlayer();

    player.on(AudioPlayerStatus.Idle, async () => {
      const q = queue.get(guildId);
      if (q && q.tracks.length > 0) {
        try {
          const connection = getVoiceConnection(guildId);
          await playNext(guildId, connection);
        } catch (err) {
          console.error('Auto-play next failed:', err);
        }
      } else if (q) {
        q.playing = false;
        q.current = null;
      }
    });

    queue.set(guildId, { tracks: [], current: null, playing: false, player });
  }
  return queue.get(guildId);
}

async function playNext(guildId, connection, accessToken) {
  const q = getQueue(guildId);
  if (q.tracks.length === 0) {
    q.playing = false;
    q.current = null;
    return;
  }

  const track = q.tracks.shift();
  q.current = track;
  q.playing = true;

  try {
    // Better way: use modular driveStream with retry + auto token refresh
    // accessToken param kept for backward compat, but we use owner id for fresh token
    const resource = await createDriveAudioResource(q.ownerDiscordId, track.id, { retries: 1 });
    connection.subscribe(q.player);
    q.player.play(resource);
  } catch (error) {
    console.error("Stream error:", error);
    if (q.tracks.length > 0) {
      try {
        const freshToken = await getValidAccessToken(q.ownerDiscordId);
        await playNext(guildId, connection, freshToken);
      } catch (e) {
        q.playing = false;
        q.current = null;
      }
    } else {
      q.playing = false;
      q.current = null;
    }
  }
}

client.on('interactionCreate', async interaction => {
  const discordId = interaction.user.id;

  if (interaction.isAutocomplete()) {
    const focusedValue = interaction.options.getFocused();
    const commandName = interaction.commandName;
    if (!focusedValue) return interaction.respond([]);

    try {
      const accessToken = await getValidAccessToken(discordId);
      let data;
      const safeValue = escapeDriveQuery(focusedValue);
      if (commandName === 'playlist') {
        data = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(`name contains '${safeValue}' and mimeType = 'application/vnd.google-apps.folder'`)}&fields=files(id,name)&pageSize=5`);
      } else {
        data = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(`name contains '${safeValue}' and mimeType contains 'audio/'`)}&fields=files(id,name)&pageSize=5`);
      }
      const choices = (data.files || []).map(file => ({ name: file.name, value: file.id }));
      await interaction.respond(choices);
    } catch (err) {
      console.error('Autocomplete error:', err);
      await interaction.respond([]);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, member } = interaction;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel && !VOICE_EXEMPT.has(commandName)) {
    return interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });
  }

  const connection = getVoiceConnection(guildId) || (voiceChannel ? joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  }) : null);

  const q = getQueue(guildId);
  q.ownerDiscordId = discordId;

  if (commandName === 'play') {
    const fileId = interaction.options.getString('query');
    await interaction.deferReply();

    try {
      const accessToken = await getValidAccessToken(discordId);
      const fileData = await driveRequest(accessToken, `/drive/v3/files/${fileId}?fields=id,name`);
      q.tracks.push({ id: fileData.id, name: fileData.name });

      if (!q.playing) {
        await playNext(guildId, connection, accessToken);
      }
      await interaction.editReply(`🎶 Added to queue: **${fileData.name}**`);
    } catch (err) {
      console.error('Play error:', err);
      await interaction.editReply('Failed to play track. Connect Google Drive in Spire web app first.');
    }
  }

  if (commandName === 'pause') {
    if (q.playing) {
      q.player.pause();
      q.playing = false;
      await interaction.reply('⏸️ Paused.');
    } else {
      await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    }
  }

  if (commandName === 'resume') {
    if (!q.playing && q.current) {
      q.player.unpause();
      q.playing = true;
      await interaction.reply('▶️ Resumed.');
    } else {
      await interaction.reply({ content: 'Nothing to resume.', ephemeral: true });
    }
  }

  if (commandName === 'stop') {
    if (connection) {
      q.player.stop();
      q.tracks = [];
      q.current = null;
      q.playing = false;
      connection.destroy();
      await interaction.reply('⏹️ Stopped and left the voice channel.');
    } else {
      await interaction.reply({ content: 'Not in a voice channel.', ephemeral: true });
    }
  }

  if (commandName === 'login') {
    const button = new ButtonBuilder()
      .setLabel('Connect Google Drive')
      .setStyle(ButtonStyle.Link)
      .setURL(`${WEB_APP_URL}/settings`);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({
      content: 'Click below to connect your Google Drive account:',
      components: [row],
      ephemeral: true,
    });
  }

  if (commandName === 'link') {
    const now = Date.now();
    const last = linkRateLimit.get(discordId);
    if (last && now - last < 30_000) {
      const wait = Math.ceil((30_000 - (now - last)) / 1000);
      return interaction.reply({ content: `Please wait ${wait}s before generating a new code.`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?discord_id=eq.${discordId}&select=id`, {
        headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': SUPABASE_SERVICE_ROLE_KEY },
      });
      const linked = await checkRes.json().catch(() => []);
      if (Array.isArray(linked) && linked.length > 0) {
        return interaction.editReply('✅ Your Discord is already linked to Spire. No need for a new code.');
      }

      await fetch(`${SUPABASE_URL}/rest/v1/linking_codes?discord_id=eq.${discordId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': SUPABASE_SERVICE_ROLE_KEY },
      });

      let code = null;
      let inserted = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/linking_codes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ code, discord_id: discordId, expires_at: expiresAt }),
        });
        if (res.ok) { inserted = true; break; }
        if (res.status !== 409) {
          const t = await res.text();
          console.error('Link insert failed:', t);
          return interaction.editReply('Failed to generate linking code. Please try again.');
        }
      }
      if (!inserted || !code) return interaction.editReply('Unable to generate a unique code. Please try again.');

      linkRateLimit.set(discordId, Date.now());
      return interaction.editReply(`Your verification code is **\`${code}\`**.\\nIt expires in 5 minutes. Enter this code in **${WEB_APP_URL.replace(/^https?:\/\//,'')}/settings** → Discord section.`);
    } catch (err) {
      console.error('Link command error:', err);
      return interaction.editReply('An error occurred while generating your code.');
    }
  }

  if (commandName === 'playlist') {
    const folderId = interaction.options.getString('name');
    await interaction.deferReply();

    try {
      const accessToken = await getValidAccessToken(discordId);
      const folderData = await driveRequest(accessToken, `/drive/v3/files/${folderId}?fields=id,name`);
      const filesData = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and mimeType contains 'audio/'`)}&fields=files(id,name)&pageSize=100`);

      const tracks = (filesData.files || []).map(file => ({ id: file.id, name: file.name }));

      if (tracks.length === 0) {
        return interaction.editReply('📂 Folder is empty or has no audio files.');
      }

      q.tracks.push(...tracks);

      if (!q.playing) {
        await playNext(guildId, connection, accessToken);
      }

      await interaction.editReply(`🎵 Added **${tracks.length} tracks** from **"${folderData.name}"** to queue.`);
    } catch (err) {
      console.error('Playlist error:', err);
      await interaction.editReply('Failed to load playlist. Connect Google Drive in Spire web app first.');
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
