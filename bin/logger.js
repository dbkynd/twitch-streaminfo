const log = require('winston')
const moment = require('moment')
const fs = require('fs')

const logDir = './logs'

// Create log directory if it does not exist
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)

// Log to console
log.remove(log.transports.Console)
log.add(log.transports.Console, {
  colorize: true,
  level: 'info',
  timestamp: moment()
    .utc()
    .format(),
})

// Log to file
log.add(require('winston-daily-rotate-file'), {
  filename: `${logDir}/-results.log`,
  json: false,
  level: 'info',
  prepend: true,
  timestamp: moment()
    .utc()
    .format(),
})

module.exports = log
