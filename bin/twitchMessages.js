'use strict';
const debug = require('debug')('streamInfo:twitchMessages');
const twitchApi = require('../bin/twitchAPI');
const { get } = require('lodash');
const config = require('../config');
const { ClipChannels } = require('../bin/mongo');

debug('Loading twitchMessages.js');

const messageCache = {};
const clipsReg = /clips\.twitch\.tv\/(\w+)|twitch.tv\/\w+\/clip\/(\w+)/;

function process(channel, userstate, message, io, twitch) { // eslint-disable-line no-unused-vars
  banNotify(channel, userstate, message);
  clipsDeletion(channel, userstate, message, twitch)
    .catch();
}

function banNotify(channel, userstate, message) {
  const name = userstate.username.toLowerCase();
  if (!messageCache[name]) messageCache[name] = [];
  messageCache[name].push({ userstate, message });
  if (messageCache[name].length > 10) messageCache[name].shift();
}

async function clipsDeletion(channel, userstate, message, twitch) {
  // Return if the message does not contain a clip
  const match = message.match(clipsReg);
  if (!match) return;
  // Extract the clip stub from the message
  const stub = match[2] || match[1];
  // Return if no stub was found
  if (!stub) return;
  // Query the Twitch API for the clip data
  const clipData = await twitchApi.getClip(stub);
  // Extract the clips channel id from the clip data
  const clipChannelId = get(clipData, 'body.data[0].broadcaster_id', null);
  // Return if the clip id matches the broadcasters id
  if (clipChannelId === config.twitch.id) return;
  // Check the database if the clips channel id is allowed
  const allowed = await ClipChannels.findOne({ channelId: clipChannelId });
  // Return if we found any matches
  if (allowed) return;
  twitch.deletemessage(channel, userstate.id);
}

module.exports = {
  process,
  cache: messageCache,
};
