'use strict';
const debug = require('debug')('streamInfo:twitchMessages');

debug('Loading twitchMessages.js');

const messageCache = {};

function process(channel, userstate, message, io) { // eslint-disable-line no-unused-vars
  processMessageForBanNotify(channel, userstate, message);
}

function processMessageForBanNotify(channel, userstate, message) {
  const name = userstate.username.toLowerCase();
  if (!messageCache[name]) messageCache[name] = [];
  messageCache[name].push({ userstate, message });
  if (messageCache[name].length > 10) messageCache[name].shift();
}

module.exports = {
  process,
  cache: messageCache,
};
