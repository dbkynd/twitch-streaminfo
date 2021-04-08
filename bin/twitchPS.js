const TwitchPS = require('twitchps')
const config = require('../config')
const log = require('winston')
const status = require('./status')
const debug = require('debug')('streamInfo:twitchPS')
const report = require('../bin/report')
const discordWebhooks = require('./discordWebhooks')

debug('Loading twitchPS.js')

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
})

// Used to prevent spamming when a chatter is banned several times close together
const banEventTimeoutCache = {
  banned: {},
  unbanned: {},
}

module.exports = (io) => {
  debug('Starting twitchPs.js')

  ps.on('connected', () => {
    log.info('connected to the Twitch PubSub')
    // Save and emit status
    status.app.twitchPs = true
    io.emit('status', { app: { twitchPs: true } })
  })

  ps.on('disconnected', () => {
    log.warn('disconnected from the Twitch PubSub')
    // Save and emit status
    status.app.twitchPs = false
    io.emit('status', { app: { twitchPs: false } })
  })

  ps.on('reconnect', () => {
    log.warn('An attempt will be made to reconnect to the Twitch PubSub')
  })

  ps.on('ban', async (data) => {
    if (banEventTimeoutCache.banned[data.target]) return
    banEventTimeoutCache.banned[data.target] = true
    setTimeout(() => {
      delete banEventTimeoutCache.banned[data.target]
    }, 1000 * 10)
    log.info(`'${data.target}' was banned for: ${data.reason}`)
    // discordWebhooks.ban(data)
    // report.newReport(data.target)
  })

  ps.on('unban', async (data) => {
    if (banEventTimeoutCache.unbanned[data.target]) return
    banEventTimeoutCache.unbanned[data.target] = true
    setTimeout(() => {
      delete banEventTimeoutCache.unbanned[data.target]
    }, 1000 * 10)
    log.info(`'${data.target}' was un-banned`)
    // discordWebhooks.unban(data)
  })
}
