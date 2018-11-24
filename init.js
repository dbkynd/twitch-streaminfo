'use strict';
const config = require('./config');
const log = require('./bin/logger');
const twitchAPI = require('./bin/twitchAPI');
const utils = require('./bin/utilities');
const emoteCache = require('./bin/emoteCache');

// Resolve the twitch user from the id in the config file before we start
twitchAPI.getUser(config.twitch.id)
  .then(results => {
    const user = utils.get(['body', 'data', 0], results);
    if (!user) {
      log.error('Unable to resolve twitch ID into user data. Twitch API may be down. ' +
        'Please try again or change ID in the config file.');
      return;
    }
    // Store the user data to the config
    config.twitch.user = user;
  })
  .then(emoteCache.init)
  .then(() => {
    // Start the application
    require('./app');
  })
  .catch(log.error);

process.on('unhandledRejection', err => {
  log.error(err);
});

process.on('uncaughtException', err => {
  log.error(err);
});
