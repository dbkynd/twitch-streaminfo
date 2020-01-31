const log = require('winston')
const twitchAPI = require('./twitchAPI')
const twitchDB = require('./twitchDB')
const config = require('../config')
const utils = require('./utilities')
const fs = require('fs')
const googleSheet = require('./googleSheet')
const debug = require('debug')('streamInfo:liveSubs')

debug('Loading liveSubs.js')

let subscribers = []
let currentlyLive = []

twitchAPI
  .getTokenData()
  .then(async (response) => {
    if (
      !config.twitch.user ||
      response.body.login !== config.twitch.user.login
    ) {
      return log.error(
        'The registered token user_name does not match the channel you have entered'
      )
    }
    if (!response.body.scopes.includes('channel_subscriptions')) {
      return log.error(
        `The token does not have the requires scope 'channel_subscriptions'`
      )
    }
    debug('Starting liveSubs.js')
    if (fs.existsSync('./subscribers')) {
      debug('Loading Subscribers from local file. Will update in 30 minutes.')
      setTimeout(getSubs, 1000 * 60 * 30)
      subscribers = JSON.parse(fs.readFileSync('./subscribers'))
    } else {
      await getSubs()
    }
    checkLive()
    setInterval(getSubs, 1000 * 60 * 60 * 8)
    setInterval(checkLive, 1000 * 60 * 10)
  })
  .catch((err) => {
    log.error(err)
    log.error('Unable to get auth token data from Twitch')
  })

function getSubs() {
  return new Promise((resolve) => {
    debug(`Getting subscribers for channel '${config.twitch.user.login}'`)
    const subs = []
    twitchAPI
      .getSubscriptions(0, 1)
      .then(async (response) => {
        debug(`Getting Sub Data for ${response.body._total} subs...`)
        for (let i = 0; i < Math.ceil(response.body._total / 100); i++) {
          const chunk = await delayedGetSub(i * 100)
          if (chunk) subs.push(chunk)
        }
        subscribers = subs.map((x) => x.map((y) => y.user._id))
        googleSheet.updateSubscriberDataSheet(response.body._total, subs)
        debug(`Done getting Subscribers (${subscribers.length})`)
        fs.writeFile(
          './subscribers',
          JSON.stringify(subscribers),
          { encoding: 'utf8' },
          (err) => {
            if (err) {
              log.error('Error saving subscriber IDs.', err)
            } else {
              log.info('Subscriber IDs saved to file.')
            }
          }
        )
        resolve()
      })
      .catch(log.error)
  })
}

function delayedGetSub(offset) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      debug(`Getting Sub Data - Offset: ${offset}`)
      twitchAPI
        .getSubscriptions(offset, 100)
        .then((response) => resolve(response.body.subscriptions))
        .catch(reject)
    }, 500)
  })
}

async function checkLive() {
  debug(`Checking live subscribers for channel '${config.twitch.user.login}'`)
  if (subscribers.length === 0) return
  const live = []
  for (let i = 0; i < subscribers.length; i++) {
    const chunk = await delayedGetLiveStreams(subscribers[i], i)
    if (chunk && chunk.data.length > 0) {
      const userIds = Array.from(new Set(chunk.data.map((x) => x.user_id))) // eslint-disable-line no-undef
      const gameIds = Array.from(new Set(chunk.data.map((x) => x.game_id))) // eslint-disable-line no-undef
      const users = await twitchDB.getUsers(userIds)
      const games = await twitchDB.getGames(gameIds)
      live.push(
        chunk.data.map((stream) => {
          stream.game = utils.get(
            ['data'],
            games.find((game) => game.twitchId === stream.game_id)
          )
          stream.user = utils.get(
            ['data'],
            users.find((user) => user.twitchId === stream.user_id)
          )
          return stream
        })
      )
    }
  }
  currentlyLive = live
    .reduce((prev, curr) => prev.concat(curr), [])
    .filter(
      (x) => x.game && x.viewer_count > 0 && x.user.id !== config.twitch.id
    )
  log.info(`Live Subs cached ${currentlyLive.length}`)
}

function delayedGetLiveStreams(chunk, index) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      debug(`Getting Live Data - Offset: ${index}`)
      twitchAPI
        .getLiveStreams(chunk)
        .then((response) => {
          resolve(response.body)
        })
        .catch(reject)
    }, 500)
  })
}

module.exports = {
  getCurrentlyLive: () => currentlyLive,
}
