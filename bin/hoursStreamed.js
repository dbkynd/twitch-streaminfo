const moment = require('moment-timezone')
const twitchAPI = require('./twitchAPI')

function getQuarter() {
  return moment.tz('America/Los_Angeles').quarter()
}

function getYear() {
  return moment.tz('America/Los_Angeles').year()
}

async function process() {
  const { body } = await twitchAPI.getArchives()
  console.log(body)
}

process()
