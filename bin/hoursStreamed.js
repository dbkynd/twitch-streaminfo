const moment = require('moment-timezone')
const twitchAPI = require('./twitchAPI')
const Archive = require('./mongo').ArchivedVideoLengths
const _ = require('lodash')

async function update() {
  const { body } = await twitchAPI.getArchivesKraken()
  const { videos } = body
  const operations = []
  videos.forEach((video) => {
    operations.push({
      updateOne: {
        filter: { videoId: video.broadcast_id },
        update: {
          videoId: video.broadcast_id,
          createdAt: video.created_at,
          length: video.length,
        },
        upsert: true,
      },
    })
  })
  if (operations.length === 0) return
  await Archive.bulkWrite(operations)
}

async function getHoursThisQuarter() {
  const startOfQuarter = moment.tz('America/Los_Angeles').startOf('quarter')
  const endOfQuarter = moment.tz('America/Los_Angeles').endOf('quarter')
  const videosThisQuarter = await Archive.find({
    createdAt: { $gte: startOfQuarter, $lte: endOfQuarter },
  })
  const sum = videosThisQuarter.reduce((prev, next) => {
    return prev + next.length
  }, 0)
  const duration = moment.duration(sum, 'seconds')
  return Math.round(duration.asHours())
}

module.exports = () => {
  // Process videos every 20 minutes
  update().catch()
  setInterval(update, 1000 * 60 * 20)
  return {
    getHoursThisQuarter,
  }
}
