require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');
const { google } = require('googleapis');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const drive = google.drive({ version: 'v3', auth: process.env.GOOGLE_DRIVE_API_KEY });
const player = createAudioPlayer();
const queue = new Map();

function getQueue(guildId) {
  if (!queue.has(guildId)) queue.set(guildId, { tracks: [], current: null, playing: false });
  return queue.get(guildId);
}

function playNext(guildId, connection) {
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
  const resource = createAudioResource(streamUrl);
  connection.subscribe(player);
  player.play(resource);
}

player.on(AudioPlayerStatus.Idle, () => {
  for (const [guildId, connection] of client.voice.adapters) {
    const q = getQueue(guildId);
    if (q.playing && q.tracks.length > 0) {
      playNext(guildId, connection);
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isAutocomplete()) {
    const focusedValue = interaction.options.getFocused();
    if (!focusedValue) return interaction.respond([]);

    try {
      const res = await drive.files.list({
        q: `name contains '${focusedValue}' and mimeType contains 'audio/'`,
        fields: 'files(id, name)',
        pageSize: 5,
      });
      const choices = res.data.files.map(file => ({
        name: file.name,
        value: file.id
      }));
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

  if (commandName === 'play') {
    const fileId = interaction.options.getString('query');
    await interaction.deferReply();

    try {
      const fileRes = await drive.files.get({ fileId, fields: 'id, name' });
      q.tracks.push({ id: fileRes.data.id, name: fileRes.data.name });

      if (!q.playing) {
        playNext(guildId, connection);
      }
      await interaction.editReply(`🎶 Added to queue: **${fileRes.data.name}**`);
    } catch (err) {
      console.error('Play error:', err);
      await interaction.editReply('Failed to play track.');
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
});

client.login(process.env.DISCORD_BOT_TOKEN);