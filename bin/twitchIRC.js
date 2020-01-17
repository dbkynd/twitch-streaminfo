'use strict';
const tmi = require('tmi.js');
const config = require('../config');
const status = require('./status');
const log = require('winston');
const twitchAPI = require('./twitchAPI');
const utils = require('./utilities');
const twitchMessages = require('./twitchMessages');
const mongo = require('./mongo');
const parser = require('./parser');
const debug = require('debug')('streamInfo:twitchIRC');

debug('Loading twitchIRC.js');

config.twitch.nick = config.twitch.nick.toLowerCase();
config.twitch.channel = `#${config.twitch.user.login}`;
config.twitch.oauth = `oauth:${config.twitch.oauth.replace('oauth:', '')}`;

let inRaidModeAuto = false;

// Set Twitch tmi options
const tmiOptions = {
  options: { debug: false },
  connection: {
    reconnect: true,
    secure: true,
  },
  identity: {
    username: config.twitch.nick,
    password: config.twitch.oauth,
  },
  channels: [config.twitch.channel],
};

const lastSubs = {};
const massGifts = {};

// Instantiate new Twitch IRC client
const twitch = new tmi.client(tmiOptions); // eslint-disable-line new-cap

module.exports = io => {
  debug('Starting twitchIrc.js');

  // Successful connection to Twitch IRC
  twitch.on('connected', (server, port) => {
    debug(`connected to: ${server}:${port}`);
    log.info(`connected to Twitch channel ${config.twitch.channel} as '${config.twitch.nick}'`);
    status.app.twitchIrc = true;
    io.emit('status', { app: { twitchIrc: true } });
  });

  // Disconnected from Twitch IRC for some reason
  twitch.on('disconnected', reason => {
    log.warn('disconnected from Twitch:', reason);
    status.app.twitchIrc = false;
    io.emit('status', { app: { twitchIrc: false } });
  });

  twitch.once('roomstate', (channel, state) => {
    // This field is only supplied on first connect (Unless streamer changes language I suppose)
    log.info(`roomstate change for ${channel}`, JSON.stringify(state, null, 2));
    if (state['emote-only'] !== null) status.channel.emoteonly = state['emote-only'];
    if (state.r9k !== null) status.channel.r9kbeta = state.r9k;
    if (state.slow !== null) status.channel.slow = state.slow;
    if (state['subs-only'] !== null) status.channel.subscribers = state['subs-only'];
    if (state['followers-only'] !== null) {
      if (state['followers-only'] === '-1') {
        status.channel.followersonly = -1;
      } else if (state['followers-only'] === false) {
        status.channel.followersonly = 0;
      } else {
        status.channel.followersonly = state['followers-only'];
      }
    }
    io.emit('status', { channel: status.channel });
  });

  // Channel toggled Emotes Only Mode
  twitch.on('emoteonly', (channel, enabled) => {
    log.info(`emoteonly in ${channel}: ${enabled}`);
    status.channel.emoteonly = enabled;
    io.emit('status', { channel: { emoteonly: enabled } });
  });

  // Channel toggled R9K Mode
  twitch.on('r9kbeta', (channel, enabled) => {
    log.info(`r9k in ${channel}: ${enabled}`);
    status.channel.r9kbeta = enabled;
    io.emit('status', { channel: { r9kbeta: enabled } });
  });

  // Channel toggled Slow Mode
  twitch.on('slowmode', (channel, enabled, length) => {
    const s = enabled ? `: ${length} seconds` : '';
    log.info(`slowmode in ${channel}: ${enabled}${s}`);
    status.channel.slow = enabled ? length : enabled;
    io.emit('status', { channel: { slow: enabled ? length : enabled } });
  });

  // Channel toggled Subscribers Mode
  twitch.on('subscribers', (channel, enabled) => {
    log.info(`sub-mode in ${channel}: ${enabled}`);
    status.channel.subscribers = enabled;
    io.emit('status', { channel: { subscribers: enabled } });
  });

  // Channel toggled Followers only Mode
  twitch.on('followersonly', (channel, enabled, length) => {
    const s = enabled ? `: ${length} minutes` : '';
    log.info(`followersonly in ${channel}: ${enabled}${s}`);
    status.channel.followersonly = enabled ? length : -1;
    io.emit('status', { channel: { followersonly: status.channel.followersonly } });
  });

  // Our mod bot was modded in our channel
  twitch.on('mod', (channel, username) => {
    if (username.toLowerCase() !== config.botName.toLowerCase()) return;
    log.info(`${username} joined the channel (modded)`);
    status.app.chatBot = true;
    io.emit('status', { app: { chatBot: true } });
  });

  // Our mod bot was unmodded in our channel
  twitch.on('unmod', (channel, username) => {
    if (username.toLowerCase() !== config.botName.toLowerCase()) return;
    log.info(`${username} parted the channel (unmodded)`);
    status.app.chatBot = false;
    io.emit('status', { app: { chatBot: false } });
  });

  // Someone hosted our channel
  twitch.on('hosted', async (channel, username, viewers, auto, userstate) => { // eslint-disable-line no-unused-vars
    log.info(`${username} hosted the channel: +${viewers} viewer(s) - auto: ${auto}`);
    // Exit if this was an auto host
    if (auto) return;
    // Exit if no or little viewers
    if (!viewers || viewers < 10) return;
    const displayName = utils.displayName(await twitchAPI.getUser(username));
    const entry = new mongo.Hosts({
      data: {
        username: displayName || username,
        viewers,
        created_at: Date.now(),
      },
    });
    io.emit('host', parser.host(entry));
    entry.save()
      .then(() => {
        utils.trimDB(mongo.Hosts);
      })
      .catch(log.error);
    // Trigger auto raid mode if over 500 viewers
    if (viewers >= 500) raidModeAuto();
  });

  twitch.on('raid', async (channel, username, raider, viewers, userstate) => {
    if (!userstate) return;
    log.info(`${userstate.login} raided from ${userstate['msg-param-login']} with ${viewers} viewers`);
    const displayName = utils.displayName(await twitchAPI.getUser(userstate['msg-param-login']));
    // Save to the database
    const entry = new mongo.Hosts({
      data: {
        username: displayName || username,
        viewers,
        created_at: Date.now(),
      },
      isRaid: true,
    });
    // Emit to clients
    io.emit('host', parser.host(entry));
    entry.save()
      .then(() => {
        utils.trimDB(mongo.Hosts);
      })
      .catch(log.error);
    raidModeAuto();
  });

  twitch.on('chat', (channel, userstate, message) => {
    twitchMessages.process(channel, userstate, message, io);
  });

  let followersTimer = null;
  // Auto raid mode
  function raidModeAuto() {
    if (inRaidModeAuto) return;
    inRaidModeAuto = true;
    twitch.say(config.twitch.channel, '!raidmode on (auto)');
    const followersAmount = status.channel.followersonly;
    const followersEnabled = followersAmount !== -1;
    if (followersEnabled) twitch.say(config.twitch.channel, '/followersoff');
    setTimeout(() => {
      twitch.say(config.twitch.channel, '!raidmode off (auto)');
      inRaidModeAuto = false;
    }, 1000 * 60 * 3);
    if (followersTimer) clearTimeout(followersTimer);
    followersTimer = setTimeout(() => {
      if (followersEnabled) twitch.say(config.twitch.channel, `/followers ${followersAmount}`);
    }, 1000 * 60 * followersAmount);
  }

  function subscription(userstate) {
    const entry = new mongo.Subscriptions({ data: userstate });
    io.emit('sub', parser.sub(entry));
    entry.save()
      .then(() => {
        utils.trimDB(mongo.Subscriptions);
      })
      .catch(err => {
        log.error('Sub Save to DB Error: ', err);
      });
    saveLastSub(userstate);
  }

  function isDuplicate(userstate) {
    const id = userstate['msg-param-recipient-id'] || userstate['user-id'];
    if (lastSubs[id]) return true;
    lastSubs[id] = setTimeout(() => {
      delete lastSubs[id];
    }, 2000);
    return false;
  }

  function saveLastSub(userstate) {
    mongo.Latest.findOneAndUpdate({ name: 'sub' }, { name: 'sub', data: userstate }, { upsert: true }).catch(log.error);
  }

  twitch.on('subscription', (channel, username, plan, msg, userstate) => {
    if (isDuplicate(userstate)) return;
    log.info(`${utils.displayName(userstate.login, userstate['display-name'])} has just subscribed with a ` +
      `${subTier(userstate['msg-param-sub-plan'])} sub.`);
    subscription(userstate);
  });

  twitch.on('resub', (channel, username, months, msg, userstate, plan) => { // eslint-disable-line no-unused-vars
    if (isDuplicate(userstate)) return;
    log.info(`${utils.displayName(userstate.login, userstate['display-name'])} has just subscribed with a ` +
      `${subTier(userstate['msg-param-sub-plan'])} sub. ${months} months in a row.`);
    subscription({ ...userstate, message: msg });
  });

  twitch.on('subgift', (channel, username, recipient, plan, userstate) => {
    if (isDuplicate(userstate)) return;
    log.info(`${utils.displayName(userstate['msg-param-recipient-user-name'],
      userstate['msg-param-recipient-display-name'])} has just subscribed, ` +
      `via a gift from ${utils.displayName(userstate.login, userstate['display-name'])}, with a ` +
      `${subTier(userstate['msg-param-sub-plan'])} sub. ${
        userstate['msg-param-months'] === true ? 1 :
          userstate['msg-param-months']
        } months in a row.`);
    if (massGifts[userstate['user-id']]) {
      massGifts[userstate['user-id']].recipients.push(userstate);
      if (massGifts[userstate['user-id']].recipients.length === massGifts[userstate['user-id']].targetLength) {
        saveLastSub(userstate);
        massGifts[userstate['user-id']].save();
      }
      return;
    }
    subscription(userstate);
  });

  twitch.on('submysterygift', (channel, username, giftCount, plan, senderCount, userstate) => {
    if (isDuplicate(userstate)) return;
    log.info(`${utils.displayName(userstate.login,
      userstate['display-name'])} has just gifted ${giftCount} ${subTier(userstate['msg-param-sub-plan'])} subs.`);
    massGifts[userstate['user-id']] = {
      recipients: [],
      targetLength: giftCount,
      timeout: setTimeout(() => {
        massGifts[userstate['user-id']].save();
      }, 5000 + (giftCount * 250)),
      save: () => {
        if (massGifts[userstate['user-id']].timeout) {
          clearTimeout(massGifts[userstate['user-id']].timeout);
          massGifts[userstate['user-id']].timeout = null;
        }
        const entry = new mongo.Subscriptions({
          data: userstate,
          recipients: massGifts[userstate['user-id']].recipients,
        });
        io.emit('sub', parser.sub(entry));
        entry.save()
          .then(() => {
            utils.trimDB(mongo.Subscriptions);
          })
          .catch(err => {
            log.error('Mass Gift Save to DB Error: ', err);
          })
          .finally(() => {
            delete massGifts[userstate['user-id']];
          });
      },
    };
  });

  twitch.on('cheer', (channel, userstate, message) => {
    log.info(`${utils.displayName(userstate.login,
      userstate['display-name'])} has just cheered with ${userstate.bits_used} bits.`);
    const data = { ...userstate, message };
    const entry = new mongo.Cheers({ data });
    io.emit('cheer', parser.cheer(entry));
    entry.save()
      .then(() => {
        utils.trimDB(mongo.Cheers);
      })
      .catch(err => {
        log.error('Cheer Save to DB Error: ', err);
      });
    mongo.Latest.findOneAndUpdate({ name: 'cheer' }, { name: 'cheer', data }, { upsert: true }).catch(log.error);
  });

  // Connect to Twitch IRC
  twitch.connect();

  io.on('connection', socket => {
    socket.on('chat_command', data => {
      let command = `/${data.command}${data.enabled ? '' : 'off'}`;
      if (data.command === 'slow' && data.enabled) command += ' 30';
      twitch.say(config.twitch.channel, command);
    });

    socket.on('toggle_raid_mode', enabled => {
      const action = enabled ? 'on' : 'off';
      const command = `!raidmode ${action}`;
      twitch.say(config.twitch.channel, command);
    });

    socket.on('add_marker', () => {
      twitch.say(config.twitch.channel, '/marker');
    });
  });
};

function subTier(amount) {
  if (amount === '1000') return 'Tier 1';
  if (amount === '2000') return 'Tier 2';
  if (amount === '3000') return 'Tier 3';
  return amount;
}
