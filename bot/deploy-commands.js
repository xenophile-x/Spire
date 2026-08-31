require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  // /play — now with shuffle/random, count/limit, plus replay/loop/repeat inside
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Search and play music from your Google Drive — with replay/loop')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Song title or artist name')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('shuffle')
        .setDescription('Shuffle/randomize the queued songs (alias: rand)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('random')
        .setDescription('Alias for shuffle — randomize the queued songs')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of matching songs to queue (default: 1, max 25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Alias for count — number of songs to queue (1-25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('repeat')
        .setDescription('Replay/repeat the queued songs N times (1-10, 1=no repeat)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('loop')
        .setDescription('Loop/replay — enable persistent replay loop (track or queue)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('replay')
        .setDescription('Alias for loop — enable replay/loop')
        .setRequired(false)
    ).toJSON(),

  // /playlist — folder play with shuffle/limit
  new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Play all tracks from a Google Drive folder (playlist)')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Folder / playlist name')
        .setAutocomplete(true)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('shuffle')
        .setDescription('Shuffle/randomize the playlist before queuing')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('random')
        .setDescription('Alias for shuffle')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Only queue first N tracks (max 100, default: all)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Alias for limit — number of tracks to queue (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    ).toJSON(),

  // /playlists — list folders
  new SlashCommandBuilder()
    .setName('playlists')
    .setDescription('List all your Google Drive folders (playlists)')
    .toJSON(),

  // /songs — list audio files
  new SlashCommandBuilder()
    .setName('songs')
    .setDescription('List all songs in your music library')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('How many to list (default: 100, max 1000)')
        .setMinValue(1)
        .setMaxValue(1000)
    ).toJSON(),

  // Playback controls
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
    .setName('skip')
    .setDescription('Skip the current track (or N tracks)')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of tracks to skip (default: 1, max 10)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    ).toJSON(),
  new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek forward/backward in current track — 10 sec back & forth')
    .addIntegerOption(option =>
      option.setName('seconds')
        .setDescription('Seconds to seek (positive=forward, negative=backward, default 10)')
        .setMinValue(-300)
        .setMaxValue(300)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('time')
        .setDescription('Alias for seconds — time to seek (e.g. 10 or -10)')
        .setMinValue(-300)
        .setMaxValue(300)
        .setRequired(false)
    ).toJSON(),
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue and now playing')
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number (10 per page, default: 1)')
        .setMinValue(1)
        .setRequired(false)
    ).toJSON(),
  new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle/randomize the current queue').toJSON(),
  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show details of the currently playing track')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('replay')
    .setDescription('Replay/restart the current track from the beginning')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Toggle or set loop/replay mode (off/track/queue)')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Loop mode: track = replay song, queue = replay queue, off = disable')
        .setRequired(false)
        .addChoices(
          { name: 'off', value: 'off' },
          { name: 'track', value: 'track' },
          { name: 'queue', value: 'queue' },
        )
    ).toJSON(),
  new SlashCommandBuilder()
    .setName('login')
    .setDescription('Get a link to connect your Google Drive to SPire')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Generate a code to link your Discord account to SPire')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show guide for all SPire bot commands')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Get detailed help for a specific command (e.g. play)')
        .setRequired(false)
        .addChoices(
          { name: 'play', value: 'play' },
          { name: 'playlist', value: 'playlist' },
          { name: 'queue', value: 'queue' },
          { name: 'skip', value: 'skip' },
          { name: 'seek', value: 'seek' },
          { name: 'shuffle', value: 'shuffle' },
          { name: 'nowplaying', value: 'nowplaying' },
          { name: 'replay', value: 'replay' },
          { name: 'loop', value: 'loop' },
          { name: 'playlists', value: 'playlists' },
          { name: 'songs', value: 'songs' },
          { name: 'pause', value: 'pause' },
          { name: 'resume', value: 'resume' },
          { name: 'stop', value: 'stop' },
          { name: 'link', value: 'link' },
          { name: 'login', value: 'login' },
        )
    ).toJSON(),
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
    console.log(`[Deploy] Commands to register: ${commands.map(c => c.name).join(', ')}`);
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
