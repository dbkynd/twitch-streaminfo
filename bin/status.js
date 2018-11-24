'use strict';
const debug = require('debug')('streamInfo:status');

debug('Loading status.js');

module.exports = {
  app: {
    tipsWs: null,
    twitchPs: null,
    twitchIrc: null,
    chatBot: null,
  },
  channel: {
    emoteonly: null,
    r9kbeta: null,
    slow: null,
    subscribers: null,
    followersonly: null,
  },
  onFrontPage: null,
  raidMode: null,
};
