const fetch = require('node-fetch')
const { get, merge } = require('lodash')
const log = require('winston')
const config = require('../config')
const status = require('./status')
const axios = require('axios')

let _io

function init(io) {
  _io = io
  getCurrentSettings().then((res) => {
    const emoteFiltersEnabled = get(res, 'botFilters.emotes.enabled', null)
    if (emoteFiltersEnabled === null) return
    // Filters ON means Raidmode is OFF
    status.raidMode = !emoteFiltersEnabled
    log.info(`Got RaidMode data. Enabled: ${status.raidMode}`)
    _io.emit('status', { raidMode: status.raidMode })
  })

  _io.on('connection', (socket) => {
    socket.on('toggle_raid_mode', (enable) => {
      toggle(enable).then(() => {
        if (enable) say('Raidmode has been toggled on.')
        else say('Raidmode has been toggled off.')
      })
    })
  })
}

function setFilter(enabled) {
  return new Promise((resolve, reject) => {
    getCurrentSettings()
      .then((res) => {
        const body = merge(res, {
          botFilters: {
            emotes: { enabled },
            caps: { enabled },
          },
        })
        body.banphrases = body.banphrases.map((x) => x._id)
        return fetch(
          `https://api.streamelements.com/kappa/v2/bot/filters/${config.streamElements.id}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${config.streamElements.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        )
      })
      .then((res) => res.json())
      .then((res) => {
        const emoteFilterEnabled = get(res, 'botFilters.emotes.enabled', null)
        const capsFilterEnabled = get(res, 'botFilters.caps.enabled', null)
        if (emoteFilterEnabled === enabled && capsFilterEnabled === enabled)
          return resolve()
        return reject()
      })
  })
}

function getCurrentSettings() {
  return fetch(
    `https://api.streamelements.com/kappa/v2/bot/filters/${config.streamElements.id}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.streamElements.token}`,
      },
    }
  ).then((res) => res.json())
}

function say(message) {
  axios
    .post(
      `https://api.streamelements.com/kappa/v2/bot/${config.streamElements.id}/say`,
      { message },
      {
        headers: {
          Authorization: `Bearer ${config.streamElements.token}`,
        },
      }
    )
    .catch()
}

let followersTimer, raidModeOffTimer
let inAutoRaidMode = false

function autoRaidMode() {
  if (inAutoRaidMode) {
    timers()
    return
  }
  inAutoRaidMode = true
  toggle(true).then(() => {
    say('Raidmode has been enabled.')
    say('/followersoff')
  })
  timers()
}

function timers() {
  if (raidModeOffTimer) clearTimeout(raidModeOffTimer)
  if (followersTimer) clearTimeout(followersTimer)
  raidModeOffTimer = setTimeout(() => {
    say(
      '10-minute followers-only mode will be enabled in 10 minutes. Please follow to continue chatting.'
    )
    toggle(false).then(() => {
      inAutoRaidMode = false
    })
  }, 1000 * 60 * 3)

  followersTimer = setTimeout(() => {
    say('/followers 10')
  }, 1000 * 60 * 13)
}

async function toggle(enable) {
  return setFilter(!enable)
    .then(() => {
      status.raidMode = enable
      log.info(`Raidmode toggled. Enabled: ${status.raidMode}`)
      if (_io) _io.emit('status', { raidMode: status.raidMode })
    })
    .catch((err) => {
      log.error(err)
      say(`There was an error ${enable ? 'enabling' : 'disabling'} Raidmode.`)
    })
}

module.exports = {
  init,
  auto: autoRaidMode,
  setFilter,
}
