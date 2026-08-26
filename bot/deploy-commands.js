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
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current track'),
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused track'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music and leave the voice channel'),
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