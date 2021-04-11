const log = require('winston')
const debug = require('debug')('report')
const config = require('../config')
const mongo = require('../bin/mongo')
const request = require('snekfetch')
const twitchAPI = require('./twitchAPI')
const moment = require('moment')

debug('Loading report.js')

module.exports = {
  startCheck(io) {
    // Check on reported users every 2 minutes
    setInterval(checkOnReported, 1000 * 120)
    checkOnReported()
    async function checkOnReported() {
      debug('Checking on reported users...')
      // Get reported list from database
      const reported = await mongo.Reported.find()
      // Exit if nothing to do
      if (!reported || reported.length === 0) {
        debug('No reported users.')
        return
      }
      debug(`${reported.length} reported users.`)
      // Investigate each user
      reported.forEach(async (x) => {
        // Remove from database if expired
        if (
          moment(x.created_at)
            .add(7, 'd')
            .valueOf() < Date.now()
        ) {
          debug(
            `${x.username} has expired with no ban. Removing from the database.`
          )
          await mongo.Reported.findByIdAndRemove(x._id)
          return
        }
        // Check user channel against Twitch api
        request
          .get(`https://api.twitch.tv/kraken/channels/${x.username}`)
          .set({
            'Client-ID': config.twitch.app.client_id,
            Authorization: `Bearer ${config.twitch.app.access_token}`,
          })
          .catch(async (banned) => {
            // 422 UNPROCESSABLE ENTRY when the channel is removed.
            if (banned.status === 422) {
              log.info(`${x.username} was Twitch channel banned`)
              // Emit event to Discord
              io.emit('discord_report_ban', x)
              // Remove banned user from the database
              await mongo.Reported.findByIdAndRemove(x._id)
            }
          })
      })
    }
  },

  async newReport(name) {
    // Check if we have an entry for this user already
    const alreadyReported = await mongo.Reported.findOne({ username: name })
    // Return if we already have reported this user
    if (alreadyReported) return
    // Get the user details from twitch
    const details = await twitchAPI.getUser(name)
    // Return if we got back results, but they contained no data
    // This means the username was likely incorrect
    if (details && details.body.data.length === 0) return
    // Create a new report entry
    const report = new mongo.Reported({
      username: name,
      data: details ? details.body.data[0] : {},
      created_at: Date.now(),
    })
    // Save to the database
    await report.save()
  },
}
