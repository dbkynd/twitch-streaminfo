const config = require('../config')
const log = require('winston')
const mongo = require('./mongo')
const status = require('./status')
const utils = require('./utilities')
const debug = require('debug')('streamInfo:streamElements')
const wsc = require('socket.io-client')
const parser = require('./parser')

debug('Loading streamElements.js')

module.exports = (io) => {
  debug('Starting streamElements.js')

  const streamElements = wsc('https://realtime.streamelements.com', {
    transports: ['websocket'],
  })

  streamElements.on('connect', () => {
    log.info('Connected to the StreamElements WebSocket')
    streamElements.emit('authenticate', {
      method: 'jwt',
      token: config.streamElements.token,
    })
  })

  streamElements.on('disconnect', () => {
    log.error('Disconnected from the StreamElements WebSocket')
    status.app.tipsWs = false
    io.emit('status', { app: { tipsWs: false } })
  })

  streamElements.on('authenticated', (data) => {
    const { channelId } = data
    log.info(`StreamElements successfully connected to channel ${channelId}`)
    status.app.tipsWs = true
    io.emit('status', { app: { tipsWs: true } })
  })

  streamElements.on('event', (event) => {
    if (!event) return
    if (event.type !== 'tip') return
    const data = event.data
    data.created_at = event.createdAt
    // Create a new tip entry
    const entry = new mongo.Tips({ data })
    io.emit('tip', parser.tip(entry))
    // Save the new tip
    entry
      .save()
      .then(() => {
        utils.trimDB(mongo.Tips)
      })
      .catch(log.error)
    mongo.Latest.findOneAndUpdate(
      { name: 'tip' },
      { name: 'tip', data },
      { upsert: true }
    ).catch(log.error)
  })
}
