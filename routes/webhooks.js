const router = require('express').Router() // eslint-disable-line new-cap
const log = require('winston')
const debug = require('debug')('streamInfo:routes:webhooks')

const lastHooks = {
  following: [],
}

router.get('/twitch/following', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  debug('Confirmation of follow webhook subscription.')
  res.send(req.query['hub.challenge'])
})

router.post('/twitch/following', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  debug('New Follow event via webhook from Twitch')
  res.sendStatus(200)
  if (!req.verified) return
  if (lastHooks.following.indexOf(req.body.id) !== -1) return
  lastHooks.following.push(req.body.id)
  if (lastHooks.length > 20) lastHooks.shift()
  debug(JSON.stringify(req.body, null, 2))
  req.io.emit('following', req.body)
})

module.exports = router
