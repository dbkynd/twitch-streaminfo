const log = require('winston')
const status = require('./status')
const socketIO = require('socket.io')
const debug = require('debug')('streamInfo:socket')
const mongo = require('./mongo')

debug('Loading socket.js')

module.exports = (server) => {
  // Create socket connection from http server object
  const io = socketIO(server)

  io.on('connection', (socket) => {
    log.info('CLIENT WEBSOCKET CONNECTED')
    socket.emit('status', status)

    socket.on('disconnect', () => {
      log.info('CLIENT WEBSOCKET CLOSED')
    })

    // Send latest sub data to latest sub websocket page
    socket.on('getLatestSub', async () => {
      const latest = await mongo.Latest.findOne({ name: 'sub' })
      socket.emit('sub', { data: latest ? latest.data : null, first: true })
    })

    // Send latest tip data to latest tip websocket page
    socket.on('getLatestTip', async () => {
      const latest = await mongo.Latest.findOne({ name: 'tip' })
      socket.emit('tip', { data: latest ? latest.data : null, first: true })
    })

    // Send latest cheer data to latest cheer websocket page
    socket.on('getLatestCheer', async () => {
      const latest = await mongo.Latest.findOne({ name: 'cheer' })
      socket.emit('cheer', { data: latest ? latest.data : null, first: true })
    })
  })

  // Export the io connection to be passed into other modules
  return io
}
