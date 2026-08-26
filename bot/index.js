require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');

const app = express();
app.get('/health', (_, res) => res.send('OK'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Health server on ${PORT}`));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const player = createAudioPlayer();
const queue = new Map();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://spire-wheat-ten.vercel.app';

async function getUserAccessToken(discordId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-drive-access-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ discord_id: discordId }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to get access token');
  }
  const data = await res.json();
  return data.access_token;
}

async function driveRequest(accessToken, endpoint, options = {}) {
  const res = await fetch(`https://www.googleapis.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  return res.json();
}

function getQueue(guildId) {
  if (!queue.has(guildId)) queue.set(guildId, { tracks: [], current: null, playing: false });
  return queue.get(guildId);
}

function playNext(guildId, connection, accessToken) {
  const q = getQueue(guildId);
  if (q.tracks.length === 0) {
    q.playing = false;
    q.current = null;
    return;
  }
  const track = q.tracks.shift();
  q.current = track;
  q.playing = true;

  const streamUrl = `https://drive.google.com/uc?export=download&id=${track.id}`;
  const resource = createAudioResource(streamUrl, { inlineVolume: true });
  connection.subscribe(player);
  player.play(resource);
}

player.on(AudioPlayerStatus.Idle, async () => {
  for (const [guildId, connection] of client.voice.adapters) {
    const q = getQueue(guildId);
    if (q.playing && q.tracks.length > 0) {
      try {
        const accessToken = await getUserAccessToken(q.ownerDiscordId);
        playNext(guildId, connection, accessToken);
      } catch (err) {
        console.error('Auto-play next failed:', err);
      }
    }
  }
});

client.on('interactionCreate', async interaction => {
  const discordId = interaction.user.id;

  if (interaction.isAutocomplete()) {
    const focusedValue = interaction.options.getFocused();
    if (!focusedValue) return interaction.respond([]);

    try {
      const accessToken = await getUserAccessToken(discordId);
      const data = await driveRequest(accessToken, `/drive/v3/files?q=${encodeURIComponent(`name contains '${focusedValue}' and mimeType contains 'audio/'`)}&fields=files(id,name)&pageSize=5`);
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

  if (!voiceChannel && commandName !== 'stop') {
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
      const accessToken = await getUserAccessToken(discordId);
      const fileData = await driveRequest(accessToken, `/drive/v3/files/${fileId}?fields=id,name`);
      q.tracks.push({ id: fileData.id, name: fileData.name });

      if (!q.playing) {
        playNext(guildId, connection, accessToken);
      }
      await interaction.editReply(`🎶 Added to queue: **${fileData.name}**`);
    } catch (err) {
      console.error('Play error:', err);
      await interaction.editReply('Failed to play track. Connect Google Drive in Spire web app first.');
    }
  }

  if (commandName === 'pause') {
    if (q.playing) {
      player.pause();
      q.playing = false;
      await interaction.reply('⏸️ Paused.');
    } else {
      await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    }
  }

  if (commandName === 'resume') {
    if (!q.playing && q.current) {
      player.unpause();
      q.playing = true;
      await interaction.reply('▶️ Resumed.');
    } else {
      await interaction.reply({ content: 'Nothing to resume.', ephemeral: true });
    }
  }

  if (commandName === 'stop') {
    if (connection) {
      player.stop();
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
});

client.login(process.env.DISCORD_BOT_TOKEN);