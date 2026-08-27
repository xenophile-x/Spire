require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Search and play music from Google Drive')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song title or artist name')
        .setAutocomplete(true)
        .setRequired(true)).toJSON(),
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current track').toJSON(),
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused track').toJSON(),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music and leave the voice channel').toJSON(),
  new SlashCommandBuilder()
    .setName('login')
    .setDescription('Connect your Google Drive account').toJSON(),
  new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Play a Google Drive folder as playlist')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Folder name (playlist name)')
        .setRequired(true)
        .setAutocomplete(true)).toJSON(),
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Generate a code to link your Discord account to Spire').toJSON(),
  // Primary Entry Point for Activity - must be kept (type 4, handler 2) else 50240
  { name: 'launch', description: 'Launch Spire Activity', type: 4, handler: 2, dm_permission: true, contexts: [0,1,2], integration_types: [0,1] },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully!');
  } catch (error) {
    console.error(error);
  }
})();