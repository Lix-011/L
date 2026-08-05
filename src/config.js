require('dotenv').config();

const TEXT_CHANNELS = [
  '1517672593627549937',
  '1517672738599338107',
  '1517672843964321822',
  '1531726850487750726',
  '1531726878925127861',
  '1531726909027913781',
];

module.exports = {
  bots: [
    { token: process.env.BOT_TOKEN_1, textChannelId: TEXT_CHANNELS[0], index: 1 },
    { token: process.env.BOT_TOKEN_2, textChannelId: TEXT_CHANNELS[1], index: 2 },
    { token: process.env.BOT_TOKEN_3, textChannelId: TEXT_CHANNELS[2], index: 3 },
    { token: process.env.BOT_TOKEN_4, textChannelId: TEXT_CHANNELS[3], index: 4 },
    { token: process.env.BOT_TOKEN_5, textChannelId: TEXT_CHANNELS[4], index: 5 },
    { token: process.env.BOT_TOKEN_6, textChannelId: TEXT_CHANNELS[5], index: 6 },
  ],
  spotify: {
    clientId:     process.env.SPOTIFY_CLIENT_ID     || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  },
  maxVolume: 130,
  defaultVolume: 80,
};
