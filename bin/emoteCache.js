const fetch = require('node-fetch')
const log = require('winston')
const config = require('../config')
const debug = require('debug')('streamInfo:twitchCache')
const fs = require('fs')

debug('Loading emoteCache.js')

let twitchEmotes
let bttvEmotes
let cheerActions

const paths = {
  twitchEmotes: './twitchEmotes.json',
  bttvEmotes: './bttvEmotes.json',
  cheerActions: './cheerActions.json',
}

function init() {
  return new Promise((resolve, reject) => {
    debug('Starting emoteCache.js')

    try {
      fs.accessSync(paths.twitchEmotes, fs.constants.R_OK)
      log.info(`Loading: ${paths.twitchEmotes}`)
      const data = fs.readFileSync(paths.twitchEmotes, { encoding: 'utf8' })
      twitchEmotes = JSON.parse(data)
    } catch (err) {
      // Do Nothing
    }

    try {
      fs.accessSync(paths.cheerActions, fs.constants.R_OK)
      log.info(`Loading: ${paths.cheerActions}`)
      const data = fs.readFileSync(paths.cheerActions, { encoding: 'utf8' })
      cheerActions = JSON.parse(data)
    } catch (err) {
      // Do Nothing
    }

    try {
      fs.accessSync(paths.bttvEmotes, fs.constants.R_OK)
      log.info(`Loading: ${paths.bttvEmotes}`)
      const data = fs.readFileSync(paths.bttvEmotes, { encoding: 'utf8' })
      bttvEmotes = JSON.parse(data)
    } catch (err) {
      // Do Nothing
    }

    Promise.all([getBttvEmotes(), getCheerActions(), getTwitchEmotes()])
      .then(resolve)
      .catch(reject)
      .finally(() => {
        /*setTimeout(() => {
          setInterval(() => {
            getBttvEmotes(true)
          }, 1000 * 60 * 60)
        }, 10000)

        setTimeout(() => {
          setInterval(() => {
            getCheerActions(true)
          }, 1000 * 60 * 60)
        }, 20000)

        setTimeout(() => {
          setInterval(() => {
            getTwitchEmotes(true)
          }, 1000 * 60 * 60)
        }, 30000)*/
      })
  })
}

const emotesToSkip = ['Hey', 'Happy']

function getTwitchEmotes(forced) {
  return new Promise((resolve, reject) => {
    if (twitchEmotes && !forced) return resolve()
    log.info('Caching Twitch Emotes')
    fetch('https://api.twitch.tv/kraken/chat/emoticons', {
      method: 'GET',
      headers: {
        'Client-ID': config.twitch.app.client_id,
        Accept: 'application/vnd.twitchtv.v5+json',
        Authorization: `Bearer ${config.twitch.ps.access_token}`,
      },
    })
      .then((res) => res.json())
      .then((results) => {
        let emoteList = {}
        results.emoticons.forEach((emote) => {
          if (emotesToSkip.includes(emote.regex)) return
          const images = emote.images
          let url
          if (Array.isArray(images)) {
            url = images[0].url
          } else {
            url = images.url
          }
          emoteList[emote.regex] = {
            url,
          }
        })
        twitchEmotes = emoteList
        emoteList = null
        fs.writeFile(
          './twitchEmotes.json',
          JSON.stringify(twitchEmotes, null, 2),
          { encoding: 'utf8' },
          (err) => {
            if (err) log.error(err)
            resolve()
          }
        )
      })
      .catch(reject)
  })
}

function getBttvEmotes(forced) {
  return new Promise((resolve, reject) => {
    if (bttvEmotes && !forced) return resolve()
    log.info('Caching BTTV Emotes')
    fetch('https://api.betterttv.net/2/emotes', {
      method: 'GET',
    })
      .then((res) => res.json())
      .then((results) => {
        let emoteList = {}
        const template = results.urlTemplate
        results.emotes.forEach((emote) => {
          emoteList[emote.code] = {
            url: `https:${template}`
              .replace('{{id}}', emote.id)
              .replace('{{image}}', '2x'),
          }
        })
        bttvEmotes = emoteList
        emoteList = null
        fs.writeFile(
          './bttvEmotes.json',
          JSON.stringify(bttvEmotes, null, 2),
          { encoding: 'utf8' },
          (err) => {
            if (err) log.error(err)
            resolve()
          }
        )
      })
      .catch(reject)
  })
}

function getCheerActions(forced) {
  return new Promise((resolve, reject) => {
    if (cheerActions && !forced) return resolve()
    log.info('Caching Cheer Actions')
    fetch(
      `https://api.twitch.tv/kraken/bits/actions?api_version=5&client_id=${config.twitch.app.client_id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.twitch.ps.access_token}`,
        },
      }
    )
      .then((res) => res.json())
      .then((results) => {
        cheerActions = results.actions
        fs.writeFile(
          './cheerActions.json',
          JSON.stringify(cheerActions, null, 2),
          { encoding: 'utf8' },
          (err) => {
            if (err) log.error(err)
            resolve()
          }
        )
      })
      .catch(reject)
  })
}

module.exports = {
  init,
  twitchEmotes: () => twitchEmotes,
  bttvEmotes: () => bttvEmotes,
  cheerActions: () => cheerActions,
}
