const log = require('winston')
const mongoose = require('mongoose')
const config = require('../config')
const moment = require('moment')
const debug = require('debug')('streamInfo:mongo')
const AutoIncrement = require('mongoose-sequence')(mongoose)

mongoose.Promise = global.Promise

debug('Loading mongo.js')

// Check that we have a valid mongo uri
const mongoURI = new RegExp(
  '^(mongodb:(?:\\/{2})?)((\\w+?):(\\w+?)@|:?@?)(.*?):?(\\d+?)?\\/(.+?)\\/?$'
)
if (!config.mongoUri || !mongoURI.test(config.mongoUri)) {
  log.error('The config.mongoURI is not valid')
  return
} else {
  debug('Valid mongoURI')
  const dbName = config.mongoUri.match(mongoURI)[7]
  debug(`Attempting to connect to the mongoDB: '${dbName}'...`)

  // Make connection to the mongo db
  mongoose.connect(
    config.mongoUri,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true,
    },
    (err) => {
      if (err) {
        log.error(`Unable to connect to the mongoDB: '${dbName}'`, err)
      } else {
        log.info(`Connected to the mongoDB: '${dbName}'`)
      }
    }
  )
}

mongoose.connection.on('connected', () => {
  // Do Nothing
})

mongoose.connection.on('error', (err) => {
  log.error('Mongoose connection error:', err ? err.stack : '')
})

mongoose.connection.on('disconnected', () => {
  log.warn('Mongoose connection disconnected')
})

// Tips
const Tips = mongoose.model(
  'tips',
  new mongoose.Schema({
    data: Object,
    cleared: Boolean,
  })
)

// Subscribers
const Subscriptions = mongoose.model(
  'subscriptions',
  new mongoose.Schema({
    data: Object,
    recipients: Array,
    cleared: Boolean,
  })
)

// Cheers
const Cheers = mongoose.model(
  'cheers',
  new mongoose.Schema({
    data: Object,
    cleared: Boolean,
  })
)

// Hosts
const Hosts = mongoose.model(
  'hosts',
  new mongoose.Schema({
    data: Object,
    cleared: Boolean,
    isRaid: Boolean,
  })
)

// Last 5 Games
const Games = mongoose.model(
  'games',
  new mongoose.Schema({
    name: String,
    id: String,
  })
)

// Twitch User Data
const TwitchUsers = mongoose.model(
  'twitch_users',
  new mongoose.Schema({
    twitchId: { type: String, index: true },
    data: Object,
    expires: { type: Date, default: moment().add(7, 'd') },
  })
)

// Twitch Game Data
const TwitchGames = mongoose.model(
  'twitch_games',
  new mongoose.Schema({
    twitchId: { type: String, index: true },
    data: Object,
    expires: { type: Date, default: moment().add(7, 'd') },
  })
)

// Twitch Reported Users
const Reported = mongoose.model(
  'twitch_reported_users',
  new mongoose.Schema({
    username: { type: String, index: true },
    data: Object,
    created_at: Date,
  })
)

// Misc counts to keep track of
const Counts = mongoose.model(
  'counts',
  new mongoose.Schema({
    name: String,
    count: Number,
  })
)

// Latest Events
const Latest = mongoose.model(
  'latests',
  new mongoose.Schema({
    name: String,
    data: Object,
  })
)

const ClipChannels = mongoose.model(
  'allowed_clip_channels',
  new mongoose.Schema({
    channelId: String,
  })
)

const SuspiciousTerms = mongoose.model(
  'suspicious_terms',
  new mongoose.Schema({
    term: String,
  })
)

const ArchivedVideoLengths = mongoose.model(
  'archived_videos_lengths',
  new mongoose.Schema({
    videoId: String,
    createdAt: Date,
    length: Number,
    locked: Boolean,
  })
)

const discordUserReportsSchema = new mongoose.Schema({
  reporter: String,
  reported: String,
  message: String,
})
discordUserReportsSchema.plugin(AutoIncrement, { inc_field: 'id' })
const DiscordUserReports = mongoose.model(
  'discord_user_reports',
  discordUserReportsSchema
)

module.exports = {
  connection: mongoose.connection,
  Subscriptions,
  Cheers,
  Tips,
  Hosts,
  Games,
  TwitchUsers,
  TwitchGames,
  Reported,
  Counts,
  Latest,
  ClipChannels,
  SuspiciousTerms,
  ArchivedVideoLengths,
  DiscordUserReports,
}
