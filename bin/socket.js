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
  })

  // Export the io connection to be passed into other modules
  return io
}
