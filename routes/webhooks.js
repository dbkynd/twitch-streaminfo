const router = require('express').Router() // eslint-disable-line new-cap
const log = require('winston')
const debug = require('debug')('streamInfo:routes:webhooks')
const request = require('snekfetch')
const config = require('../config')

const lastHooks = {
  following: [],
}

router.get('/twitch/following', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  debug('Confirmation of follow webhook subscription.')
  res.send(req.query['hub.challenge'])
})

router.post('/twitch/following', async (req, res, next) => {
  // eslint-disable-line no-unused-vars
  debug('New Follow event via webhook from Twitch')
  // return 200 OK to twitch immediately
  res.sendStatus(200)
  // stop if not a validated request using the secret
  if (!req.verified) return
  // extract the data object from the request body
  const data = req.body.data[0]
  // stop if no data (shouldn't be a thing)
  if (!data) return
  // ensure no duplicates
  if (lastHooks.following.indexOf(data.from_id) !== -1) return
  lastHooks.following.push(data.from_id)
  if (lastHooks.length > 20) lastHooks.shift()
  debug(JSON.stringify(data, null, 2))
  // emit that we got a new follower to the client page
  req.io.emit('following', data)
  // check for suspicious terms in the user name
  const query = `{"$where": "function() { return '${data.from_name.toLowerCase()}'.includes(this.term) }"}`
  const match = await req.db.SuspiciousTerms.findOne(JSON.parse(query))
  // stop if no matching terms
  if (!match || match.length === 0) return
  // send webhook to #mod-chat in discord @ing the moderators role
  request
    .post(config.discord.susFollowerWebhookUrl)
    .send({
      content: `<@&${config.discord.mentionRoleId}> \`\`${data.from_name}\`\` <https://www.twitch.tv/popout/annemunition/viewercard/${data.from_name}>`,
    })
    .catch((err) => {
      debug('Error sending a SUSPICIOUS FOLLOWER DETECTED Webhook to Discord')
      log.error(err)
    })
})

module.exports = router
