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
      // const action = enable ? 'on' : 'off' // TODO
      // say(`!raidmode ${action}`)
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

let followersTimer, raidModeOffTimer, followersAmount
let inAutoRaidMode = false
let hadFollowersOn = false

// Auto raid mode
function autoRaidMode() {
  // Reset the timers if already in auto RaidMode
  if (inAutoRaidMode) {
    timers()
    return
  }
  inAutoRaidMode = true
  toggle(true)
  followersAmount = status.channel.followersonly
  hadFollowersOn = followersAmount !== -1
  if (hadFollowersOn) say('/followersoff')
  timers()
}

function timers() {
  if (raidModeOffTimer) clearTimeout(raidModeOffTimer)
  if (followersTimer) clearTimeout(followersTimer)
  raidModeOffTimer = setTimeout(() => {
    toggle(false)
    inAutoRaidMode = false
  }, 1000 * 60 * 5)

  // Don't set followers timers if followers was off initially
  if (!hadFollowersOn) return

  // Enable followers-only after 10 minutes
  followersTimer = setTimeout(() => {
    say('/followers')
    say(
      `Enabled followers-only mode. Please follow to continue chatting. ${followersAmount} minute followers-only will be enabled in 10 minutes.`
    )
  }, 1000 * 60 * 10)

  followersTimer = setTimeout(() => {
    say(`/followers ${followersAmount}`)
  }, 1000 * 60 * 20)
}

function toggle(enabled) {
  setFilter(!enabled)
    .then(() => {
      status.raidMode = enabled
      log.info(`Raidmode set. Enabled: ${status.raidMode}`)
      _io.emit('status', { raidMode: status.raidMode })
      say(`Raidmode has been ${enabled ? 'enabled' : 'disabled'}.`)
    })
    .catch((err) => {
      log.error(err)
      say(`There was an error ${enabled ? 'enabling' : 'disabling'} Raidmode.`)
    })
}

module.exports = {
  init,
  auto: autoRaidMode,
}
