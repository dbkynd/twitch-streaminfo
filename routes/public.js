const router = require('express').Router() // eslint-disable-line new-cap
const uptime = require('../bin/uptime')
const games = require('../bin/lastGames')
const moment = require('moment')
const log = require('winston')
const liveSubs = require('../bin/liveSubs')
const raidmode = require('../bin/raidmode')
const report = require('../bin/report')
const status = require('../bin/status')
const request = require('node-fetch')
const config = require('../config')
const { get } = require('lodash')
const twitchApi = require('../bin/twitchAPI')
const hoursStreamed = require('../bin/hoursStreamed')()

require('moment-timezone')

router.get('/uptime', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.send(uptime.getUptime())
})

router.get('/timestamp', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.send(uptime.getTimestamp())
})

router.get('/song', (req, res, next) => {
  request(
    `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&limit=2&user=annemunition&api_key=${config.lastfm.apiKey}&format=json`
  )
    .then((res) => res.json())
    .then((data) => {
      const tracks = get(data, 'recenttracks.track', null)
      if (!tracks) return res.status(200).send('Unable to get tracks.')
      const nowPlaying = tracks.find((track) =>
        get(track, '@attr.nowplaying', null)
      )
      if (!nowPlaying) res.status(200).send('No song is currently playing.')
      const str = `${get(nowPlaying, 'name', 'Track')} by ${get(
        nowPlaying,
        'artist.#text',
        'Artist'
      )}`
      res.status(200).send(str)
    })
    .catch(() => {
      res.status(200).send('LastFM Error')
    })
})

router.get('/games', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  req.db.Games.find({})
    .sort({ _id: -1 })
    .then((gameResults) => {
      if (gameResults.length > 0) {
        res.send(
          `The last played games are: ${gameResults
            .map((g) => games.mutateName(g.name))
            .join(' | ')}`
        )
      } else {
        res.send('No games have been saved.')
      }
    })
    .catch(() => {
      res.sendStatus(503)
    })
})

router.get('/latestSub', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.render('latestSub')
})

router.get('/latestTip', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.render('latestTip')
})

router.get('/latestCheer', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.render('latestCheer')
})

router.get('/time', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.send(
    `Anne's clock reads: ${moment
      .tz('America/Los_Angeles')
      .format('ddd, h:mma zz')}`
  )
})

router.get('/getLiveSubs', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.json(liveSubs.getCurrentlyLive())
})

router.get('/getLiveSubsCount', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.send(liveSubs.getCurrentlyLive().length.toString())
})

router.get('/whatNow', async (req, res, next) => {
  // eslint-disable-line no-unused-vars
  const countRecord = await req.db.Counts.findOne({ name: 'liveSubs' })
  const oldCount = countRecord ? countRecord.count : 0
  const currentCount = liveSubs.getCurrentlyLive().length
  let str
  if (currentCount > oldCount) {
    str =
      `${currentCount} of Anne's subscribers are currently live. ` +
      `Find out who at: http://annemunition.tv/armory NEW RECORD! PogChamp`
    if (countRecord) {
      countRecord.count = currentCount
      countRecord.save()
    } else {
      const newCount = new req.db.Counts({
        name: 'liveSubs',
        count: currentCount,
      })
      newCount.save()
    }
  } else {
    str = `${currentCount} of Anne's subscribers are currently live. Find out who at: https://annemunition.tv/armory`
  }
  res.send(str)
})

router.get('/liveSubs', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.render('liveSubs', {})
})

router.get('/allCleared', async (req, res, next) => {
  // eslint-disable-line no-unused-vars
  const tips = await req.db.Tips.countDocuments({ cleared: false })
  const subs = await req.db.Subscriptions.countDocuments({ cleared: false })
  const cheers = await req.db.Cheers.countDocuments({ cleared: false })
  res.json(tips + subs + cheers === 0)
})

// Report a user on Twitch
router.get('/report/:name', async (req, res) => {
  // Extract the username
  const name = req.params.name.toLowerCase()
  // Send the user to the twitch report page right away
  res.redirect(`https://www.twitch.tv/${name}/report`)
  await report.newReport(name)
})

router.get('/reported', async (req, res) => {
  // Return a JSON formatted list of all those currently in the report list
  const reported = await req.db.Reported.find()
  res.json(reported || [])
})

router.get('/reported/purge', (req, res) => {
  // Remove all documents from the report collection
  req.db.Reported.remove({})
    .exec()
    .then(() => {
      res.sendStatus(200)
    })
    .catch(() => {
      res.sendStatus(503)
    })
})

router.get('/reported/purge/:name', async (req, res) => {
  // Find the user if exists
  req.db.Reported.findOne({ username: req.params.name })
    .then((user) => {
      // Return 404 if no user found
      if (!user) return res.sendStatus(404)
      // Remove the user
      user.remove().then(() => {
        // Return OK
        res.sendStatus(200)
      })
    })
    .catch(() => {
      // Return Error
      res.sendStatus(503)
    })
})

router.get('/clips', async (req, res, next) => {
  // lowercase all request parameters
  for (const key in req.query) {
    if (req.query.hasOwnProperty(key)) {
      req.query[key] = req.query[key].toLowerCase()
    }
  }
  // Extract the action and target from the query parameters
  const { action, target } = req.query
  // Show usage if missing data
  if (!action || !target) {
    return res.status(200).send('Usage: !clips <allow|deny> <channel>')
  }
  // Show usage if action is not allow or deny
  if (action !== 'allow' && action !== 'deny') {
    return res.status(200).send('Usage: !clips <allow|deny> <channel>')
  }
  // Get the user data about the target from the Twitch API
  let targetData
  try {
    targetData = get(await twitchApi.getUser(target), 'body.data[0]', null)
  } catch (e) {
    return res.status(200).send('Twitch API error. Please try again.')
  }
  // Respond if there is no user found
  if (!targetData) {
    return res.status(200).send(`'${target}' is not a registered Twitch user.`)
  }
  // Get any existing record for this target from the database
  const existingRecord = await req.db.ClipChannels.findOne({
    channelId: targetData.id,
  })
  if (action === 'allow') {
    if (existingRecord) {
      return res
        .status(200)
        .send(
          `Clips from ${targetData.display_name ||
            target.login} are already allowed.`
        )
    } else {
      // Save a new record
      await new req.db.ClipChannels({
        channelId: targetData.id,
      }).save()
      return res
        .status(200)
        .send(
          `Clips from ${targetData.display_name ||
            target.login} are now allowed.`
        )
    }
  } else if (action === 'deny') {
    if (!existingRecord) {
      return res
        .status(200)
        .send(
          `Clips from ${targetData.display_name ||
            target.login} are already denied.`
        )
    } else {
      // Delete the existing record
      await existingRecord.remove()
      return res
        .status(200)
        .send(
          `Clips from ${targetData.display_name ||
            target.login} are now denied.`
        )
    }
  }
})

router.get('/hours', async (req, res, next) => {
  try {
    const hours = await hoursStreamed.getHoursThisQuarter()
    res.status(200).send(hours.toString())
  } catch (e) {
    next(e)
  }
})

module.exports = (io) => {
  router.get('/sub_games_advance_queue', (req, res, next) => {
    // eslint-disable-line no-unused-vars
    // Forbidden if nightbot response url is not passed in headers
    if (!req.headers['nightbot-response-url']) return res.sendStatus(403)
    res.send(' ')
    io.emit('sub_games_advance_queue', req.headers)
  })

  router.get('/raidmode', (req, res) => {
    const action = req.query.q || 'on'
    switch (action.toLowerCase()) {
      case 'on':
      case 'enable':
        toggle(true)
        break
      case 'off':
      case 'disable':
        toggle(false)
        break
      default:
        return res.sendStatus(400)
    }

    function toggle(enabled) {
      raidmode
        .setFilter(!enabled)
        .then(() => {
          status.raidMode = enabled
          log.info(`RaidMode set. Enabled: ${status.raidMode}`)
          io.emit('status', { raidMode: status.raidMode })
          res
            .status(200)
            .send(`Raidmode has been ${enabled ? 'enabled' : 'disabled'}.`)
        })
        .catch((err) => {
          log.error(err)
          res
            .status(200)
            .send(
              `There was an error ${
                enabled ? 'enabling' : 'disabling'
              } Raidmode.`
            )
        })
    }
  })

  return router
}
