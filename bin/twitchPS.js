'use strict';
const TwitchPS = require('twitchps');
const config = require('../config');
const log = require('winston');
const status = require('./status');
const utils = require('./utilities');
const twitchMessages = require('./twitchMessages');
const twitchAPI = require('./twitchAPI');
const debug = require('debug')('streamInfo:twitchPS');
const report = require('../bin/report');

debug('Loading twitchPS.js');

// Instantiate new Twitch PUB/SUB client
const ps = new TwitchPS({
  init_topics: [
    {
      topic: `chat_moderator_actions.${config.twitch.ps.id}.${config.twitch.ps.id}`,
      token: config.twitch.ps.access_token,
    },
  ],
  reconnect: true,
  debug: false,
});

// Used to prevent spamming when a chatter is banned several times close together
const banEventTimeoutCache = {
  banned: {},
  unbanned: {},
};

module.exports = io => {
  debug('Starting twitchPs.js');

  ps.on('connected', () => {
    log.info('connected to the Twitch PubSub');
    // Save and emit status
    status.app.twitchPs = true;
    io.emit('status', { app: { twitchPs: true } });
  });

  ps.on('disconnected', () => {
    log.warn('disconnected from the Twitch PubSub');
    // Save and emit status
    status.app.twitchPs = false;
    io.emit('status', { app: { twitchPs: false } });
  });

  ps.on('reconnect', () => {
    log.warn('An attempt will be made to reconnect to the Twitch PubSub');
  });

  ps.on('ban', async data => {
    if (banEventTimeoutCache.banned[data.target]) return;
    banEventTimeoutCache.banned[data.target] = true;
    setTimeout(() => {
      delete banEventTimeoutCache.banned[data.target];
    }, 1000 * 10);
    log.info(`'${data.target}' was banned for: ${data.reason}`);
    report.newReport(data.target);
    const messages = twitchMessages.cache[data.target.toLowerCase()] || [];
    io.emit('discord_ban_event', {
      banee: utils.displayName(utils.get(['body', 'data', 0],
        await twitchAPI.getUser(data.target))) || data.target_user_id,
      banee_id: data.target_user_id,
      banear: utils.displayName(utils.get(['body', 'data', 0],
        await twitchAPI.getUser(data.created_by))) || data.created_by_user_id,
      banear_id: data.created_by_user_id,
      reason: data.reason,
      messages,
      time: Date.now(),
    });
    log.info('Ban Emitted');
    if (twitchMessages.cache[data.target.toLowerCase()]) delete twitchMessages.cache[data.target.toLowerCase()];
  });

  ps.on('unban', async data => {
    if (banEventTimeoutCache.unbanned[data.target]) return;
    banEventTimeoutCache.unbanned[data.target] = true;
    setTimeout(() => {
      delete banEventTimeoutCache.unbanned[data.target];
    }, 1000 * 10);
    log.info(`'${data.target}' was un-banned`);
    io.emit('discord_unban_event', {
      banee: utils.displayName(utils.get(['body', 'data', 0],
        await twitchAPI.getUser(data.target))) || data.target_user_id,
      banee_id: data.target_user_id,
      banear: utils.displayName(utils.get(['body', 'data', 0],
        await twitchAPI.getUser(data.created_by))) || data.created_by_user_id,
      banear_id: data.created_by_user_id,
      time: Date.now(),
    });
    log.info('Un-Ban Emitted');
  });
};
