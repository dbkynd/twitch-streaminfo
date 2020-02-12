const config = require('../config')
const log = require('winston')
const request = require('snekfetch')
const moment = require('moment')
const utils = require('./utilities')
const lastGames = require('./lastGames')
const twitchAPI = require('./twitchAPI')
const status = require('./status')
const debug = require('debug')('streamInfo:stream')
const mongo = require('./mongo')

debug('Loading stream.js')

const liveStatus = {
  isOnline: false,
  showsOnline: false,
  timeStarted: null,
  timeStopped: null,
  body: null,
  isHosting: false,
  targetId: null,
  targetBody: null,
}

// Keep the resolved game ids to names to keep api calls down
// Items will expire in 7 days and be re-resolved for name changes
const gamesCache = new Map() // eslint-disable-line no-undef

pollStreamStatus()
setInterval(pollStreamStatus, 1000 * 60)

function pollStreamStatus() {
  // See if this channel is hosting another channel
  request
    .get(
      `https://tmi.twitch.tv/hosts?include_logins=1&host=${config.twitch.id}`
    )
    .then((hostResult) => {
      const host = hostResult.body
      // If there is a target_id the channel is hosting another
      if (host.hosts[0].target_id) {
        // Save that we are hosting
        liveStatus.isHosting = true
        // Save the hosted channel's id
        liveStatus.targetId = host.hosts[0].target_id
      } else {
        // Save that we are NOT hosting
        liveStatus.isHosting = false
        // Clear the hosted channel's id
        liveStatus.targetId = null
      }
      // Get the hosted channels stream data or our own
      request
        .get(
          `https://api.twitch.tv/helix/streams?user_id=${liveStatus.targetId ||
            config.twitch.id}&type=live`
        )
        .set({ 'Client-ID': config.twitch.app.client_id })
        .then((streamResult) => {
          const stream = utils.get(['body', 'data', 0], streamResult)
          // Clear data if we are now hosting
          if (liveStatus.isHosting) {
            liveStatus.targetBody = stream
            liveStatus.isOnline = false
            liveStatus.showsOnline = false
            liveStatus.timeStarted = null
            liveStatus.timeStopped = null
            liveStatus.body = null
            return
          }
          liveStatus.targetBody = null
          liveStatus.body = stream
          if (stream) {
            // Twitch sees channel as actively streaming
            liveStatus.showsOnline = true
            storeGame(stream)
            storeMaxViewCount(stream.viewer_count)
            if (liveStatus.isOnline) {
              liveStatus.timeStopped = null
            } else {
              // Save that streamer is live
              liveStatus.isOnline = true
              // Save stream start time
              liveStatus.timeStarted = moment(stream.started_at)
                .utc()
                .format()
            }
          } else {
            // Twitch does not sees channel as actively streaming
            liveStatus.showsOnline = false
            // Don't need to do anything if we are already set to offline
            if (!liveStatus.isOnline) {
              return
            }
            if (liveStatus.timeStopped) {
              if (
                moment() >
                moment(liveStatus.timeStopped).add(
                  config.minutesBeforeConsideredOffline,
                  'm'
                )
              ) {
                // Enough time has past. Streamer likely has stopped streaming for the day.
                liveStatus.isOnline = false
                liveStatus.timeStarted = null
                liveStatus.timeStopped = null
              }
            } else {
              // First stored stream drop
              liveStatus.timeStopped = moment()
            }
          }
        })
        .catch(log.error)
    })
    .catch(log.error)
}

async function storeGame(stream) {
  if (!stream) return
  const game = await getGameData(stream.game_id)
  if (!game) return
  lastGames.addGame(game)
}

async function storeMaxViewCount(viewerCount) {
  debug('viewerCount', viewerCount)
  const lastCount = await mongo.Counts.findOne({ name: 'viewerCount' })
  let max = viewerCount
  if (lastCount) {
    max = Math.max(viewerCount, lastCount.count)
    debug('old', lastCount.count)
    debug('new', viewerCount)
    debug('max', max)
    if (max !== lastCount.count) {
      lastCount.count = max
      debug('saving max viewerCount', lastCount)
      lastCount.save().catch(log.error)
    }
  } else {
    const entry = new mongo.Counts({
      name: 'viewerCount',
      count: viewerCount,
    })
    debug('saving new viewerCount', entry)
    entry.save().catch(log.error)
  }
}

function getGameData(gameId) {
  return new Promise((resolve) => {
    // If we have the game saved and the time has not expired return the game data
    if (gamesCache.has(gameId) && gamesCache.get(gameId).expires > Date.now()) {
      return resolve(gamesCache.get(gameId))
    }
    // Otherwise make a Twitch request to get the latest game data
    twitchAPI
      .getGame(gameId)
      .then((gameResult) => {
        // Extract the game data
        const game = utils.get(['body', 'data', 0], gameResult)
        // Add an expiration time
        game.expires = Date.now() + 1000 * 60 * 60 * 24 * 7
        // Add the game to the cache
        gamesCache.set(game.id, game)
        resolve(game)
      })
      .catch(log.error)
  })
}

module.exports = (io) => {
  function start() {
    // Check if we are on the front page every five minutes
    checkFrontPage()
    setInterval(checkFrontPage, 1000 * 60 * 5)
  }

  // See if our streamer is on the front page
  function checkFrontPage() {
    return new Promise((resole, reject) => {
      request
        .get(
          `https://api.twitch.tv/kraken/streams/featured` +
            `?client_id=${config.twitch.app.client_id}&api_version=5`
        )
        .then((response) => {
          // Exit if we don't have the data we need to continue
          if (!response.body || !response.body.featured) return
          const existsOnFrontPage = Boolean(
            response.body.featured.find(
              (x) =>
                x.stream.channel._id.toString() ===
                  config.twitch.id.toString() && x.priority <= 6
            )
          )
          // Return if there was no change
          if (existsOnFrontPage === status.onFrontPage) return
          // Store current state
          status.onFrontPage = existsOnFrontPage
          // Emit changed state
          io.emit('status', { onFrontPage: existsOnFrontPage })
        })
        .catch(reject)
    })
  }

  return {
    start,
    status: liveStatus,
    games: gamesCache,
    getGameData,
  }
}
