const request = require('snekfetch')
const config = require('../config')
const log = require('winston')
const randomString = require('randomstring')
const debug = require('debug')('streamInfo:webhooks')

debug('Loading webhooks.js')

const secret = randomString.generate()

setInterval(subscribe, 1000 * 60 * 60 * 24 * 9)
subscribe()

function subscribe() {
  debug('Subscribing to Twitch Webhooks...')
  request
    .post('https://api.twitch.tv/helix/webhooks/hub')
    .set({
      'Client-ID': config.twitch.app.client_id,
      Authorization: `Bearer ${config.twitch.ps.access_token}`,
    })
    .send({
      'hub.mode': 'subscribe',
      'hub.topic': `https://api.twitch.tv/helix/users/follows?to_id=${config.twitch.id}`,
      'hub.callback': `${config.twitch.webHookBaseUrl}/webhooks/twitch/following`,
      'hub.lease_seconds': 864000,
      'hub.secret': secret,
    })
    .catch((err) => {
      debug('Error subscribing to Twitch Webhooks')
      log.error(err)
    })
}

module.exports = {
  secret,
}
