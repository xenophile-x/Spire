require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Search and play music from your Google Drive')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song title or artist name')
        .setAutocomplete(true)
        .setRequired(true)
    ).toJSON(),
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause current track').toJSON(),
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume paused track').toJSON(),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback, clear queue, and leave voice channel').toJSON(),
  new SlashCommandBuilder()
    .setName('login')
    .setDescription('Connect your Google Drive account via SPire Web App').toJSON(),
  new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Play a Google Drive folder as a playlist')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Select a music folder')
        .setRequired(true)
        .setAutocomplete(true)
    ).toJSON(),
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Generate a 6-digit code to link your Discord account').toJSON(),
  {
    name: 'launch',
    description: 'Launch SPire Activity',
    type: 4,
    handler: 2,
    dm_permission: true,
    contexts: [0, 1, 2],
    integration_types: [0, 1]
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('[Deploy] Registering application (slash) commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('[Deploy] Application commands registered successfully.');
  } catch (error) {
    console.error('[Deploy] Failed to register slash commands:', error);
    process.exit(1);
  }
})();