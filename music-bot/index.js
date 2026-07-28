require('dotenv').config();
const playdl = require('play-dl');
const { bots, spotify } = require('./src/config');
const Bot = require('./src/Bot');

async function init() {
  if (spotify.clientId && spotify.clientSecret) {
    await playdl.setToken({
      spotify: {
        client_id:     spotify.clientId,
        client_secret: spotify.clientSecret,
        refresh_token: process.env.SPOTIFY_REFRESH_TOKEN || '',
        market:        'SA',
      },
    });
    console.log('[Spotify] Token set successfully');
  } else {
    console.warn('[Spotify] No credentials — Spotify links may not work');
  }

  for (const config of bots) {
    const bot = new Bot(config);
    await bot.login();
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ All ${bots.length} Lś Music bots started!\n`);
}

init().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
