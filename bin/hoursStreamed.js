const moment = require('moment-timezone')
const twitchAPI = require('./twitchAPI')
const Archive = require('./mongo').ArchivedVideoLengths
const _ = require('lodash')

async function update() {
  const { body } = await twitchAPI.getArchivesKraken()
  const { videos } = body
  const locked = await Archive.find({ locked: true })
  const lockedIds = locked.map((x) => x.videoId)
  const operations = []
  videos.forEach((video) => {
    if (lockedIds.includes(video.broadcast_id)) return
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
  const startOfQuarter = moment
    .tz('America/Los_Angeles')
    .startOf('quarter')
    .subtract(1, 'month')
    .startOf('month')
  const endOfQuarter = moment
    .tz('America/Los_Angeles')
    .endOf('quarter')
    .subtract(1, 'month')
    .endOf('month')
  const startOfLastQuarter = moment
    .tz('America/Los_Angeles')
    .startOf('quarter')
    .subtract(1, 'quarter')
    .subtract(1, 'month')
    .startOf('month')
  const endOfLastQuarter = moment
    .tz('America/Los_Angeles')
    .endOf('quarter')
    .subtract(1, 'quarter')
    .subtract(1, 'month')
    .endOf('month')
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
