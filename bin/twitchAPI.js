const config = require('../config')
const log = require('winston')
const debug = require('debug')('streamInfo:twitchAPI')
const axios = require('axios')

debug('Loading twitchAPI.js')

module.exports = {
  getUser: (identity) => {
    const type = /^\d+$/.test(identity) ? 'id' : 'login'
    const url = `https://api.twitch.tv/helix/users?${type}=${identity}`
    return fetch(url, helixHeaders())
  },

  getVideos: (id, type = 'all') => {
    const url = `https://api.twitch.tv/helix/videos?user_id=${id}?type=${type}`
    return fetch(url, helixHeaders())
  },

  getArchivesKraken: () => {
    const url = `https://api.twitch.tv/kraken/channels/${config.twitch.id}/videos?broadcast_type=archive`
    return fetch(url, krakenHeaders())
  },

  getGame: (id) => {
    const url = `https://api.twitch.tv/helix/games?id=${id}`
    return fetch(url, helixHeaders())
  },

  getTokenData: () => {
    const url = 'https://id.twitch.tv/oauth2/validate'
    const headers = {
      Authorization: `OAuth ${config.twitch.ps.access_token}`,
    }
    return fetch(url, headers)
  },

  getSubscriptions: (offset = 0, limit = 25) => {
    const url =
      `https://api.twitch.tv/kraken/channels/${config.twitch.id}/subscriptions` +
      `?offset=${offset}&limit=${limit}`
    return fetch(url, krakenHeaders())
  },

  getLiveStreams: (idsArray) => {
    const url = `https://api.twitch.tv/helix/streams/?type=live${idsArray
      .map((x) => `&user_id=${x}`)
      .join('')}`
    return fetch(url, krakenHeaders())
  },

  getUsers: (loginOrIdArray) => {
    const query = loginOrIdArray
      .map((x) => {
        const type = /^\d+$/.test(x) ? 'id' : 'login'
        return `&${type}=${x}`
      })
      .join('')
      .replace('&', '?')
    const url = `https://api.twitch.tv/helix/users${query}`
    return fetch(url, helixHeaders())
  },

  getGames: (ids) => {
    const query = ids
      .map((x) => `&id=${x}`)
      .join('')
      .replace('&', '?')
    const url = `https://api.twitch.tv/helix/games${query}`
    return fetch(url, helixHeaders())
  },

  getClip: (stub) => {
    const url = `https://api.twitch.tv/helix/clips?id=${stub}`
    return fetch(url, helixHeaders())
  },

  getUserByIdKraken: (userId) => {
    const url = `https://api.twitch.tv/kraken/users/${userId}`
    return fetch(url, krakenHeaders())
  },
}

function helixHeaders() {
  return {
    'Client-ID': config.twitch.app.client_id,
    Authorization: `Bearer ${config.twitch.ps.access_token}`,
  }
}

function krakenHeaders() {
  return {
    'Client-ID': config.twitch.app.client_id,
    Authorization: `OAuth ${config.twitch.ps.access_token}`,
    Accept: 'application/vnd.twitchtv.v5+json',
  }
}

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    function tryRequest() {
      axios
        .get(url, { headers })
        .then(({ data }) => {
          resolve({ body: data, data })
        })
        .catch((error) => {
          if (error.body && error.body.status === 429) {
            const resetTime = parseInt(error.headers['ratelimit-reset']) * 1000
            const ms = resetTime - Date.now() + 500
            log.error(`TWITCH RATE LIMIT. Retrying in ${ms}ms`)
            setTimeout(tryRequest, ms > 0 ? ms : 500)
          } else {
            reject(error)
          }
        })
    }

    tryRequest()
  })
}
