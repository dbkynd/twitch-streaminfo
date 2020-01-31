const moment = require('moment')
const stream = require('./stream')()
const debug = require('debug')('streamInfo:uptime')

debug('Loading uptime.js')

function getUptime() {
  if (!stream.status.showsOnline || !stream.status.timeStarted) {
    return 'The stream is currently offline.'
  }
  let str = 'The stream has been live for'
  const duration = moment.duration(moment() - moment(stream.status.timeStarted))
  if (duration._data.days > 0) {
    str += ` ${duration._data.days}`
    str += duration._data.days === 1 ? ' day' : ' days'
    if (duration._data.hours > 0) {
      str += duration._data.minutes === 0 ? ' and' : ','
    }
  }
  if (duration._data.hours > 0) {
    str += ` ${duration._data.hours}`
    str += duration._data.hours === 1 ? ' hour' : ' hours'
  }
  if (
    (duration._data.hours > 0 || duration._data.days > 0) &&
    duration._data.minutes > 0
  ) {
    str += ' and'
  }
  if (
    duration._data.minutes > 0 ||
    (duration._data.days === 0 &&
      duration._data.hours === 0 &&
      duration._data.minutes === 0)
  ) {
    str += ` ${duration._data.minutes}`
    str += duration._data.minutes === 1 ? ' minute' : ' minutes'
  }
  str += '.'
  return str
}

function getTimestamp() {
  if (!stream.status.showsOnline || !stream.status.timeStarted) {
    return 'Offline'
  } else {
    return stream.status.timeStarted
  }
}

module.exports = {
  getUptime,
  getTimestamp,
}
