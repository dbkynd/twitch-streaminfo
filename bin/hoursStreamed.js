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
  const startOfLastQuarter = moment(startOfQuarter)
    .subtract(1, 'quarter')
    .startOf('quarter')
  const endOfLastQuarter = moment(endOfQuarter)
    .subtract(1, 'quarter')
    .endOf('quarter')
  return {
    thisQuarter: await getHours(startOfQuarter, endOfQuarter),
    lastQuarter: await getHours(startOfLastQuarter, endOfLastQuarter),
  }
}

async function getHours(start, end) {
  const videos = await Archive.find({
    createdAt: { $gte: start, $lte: end },
  })
  const sum = videos.reduce((prev, next) => {
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
