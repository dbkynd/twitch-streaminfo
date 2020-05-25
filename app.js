const config = require('./config')
const log = require('winston')
const express = require('express')
const path = require('path')
const favicon = require('serve-favicon')
const logger = require('morgan')
const session = require('express-session')
const bodyParser = require('body-parser')
const passport = require('passport')
const TwitchStrategy = require('@d-fischer/passport-twitch').Strategy
const MongoStore = require('connect-mongo')(session)
const http = require('http')
const crypto = require('crypto')
const debug = require('debug')('streamInfo:app')

debug('Loading app.js')

const app = express()

// Use port from config or use 3000 by default
const port = normalizePort(config.port || '3000')
app.set('port', port)

// Create server and instantiate socket.io
const server = http.createServer(app)
const io = require('./bin/socket')(server)

const mongo = require('./bin/mongo')

require('./bin/streamElements')(io)
require('./bin/twitchPS')(io)
require('./bin/twitchIRC')(io)
const report = require('./bin/report')
report.startCheck(io)
const stream = require('./bin/stream')(io)
stream.start()
const raidmode = require('./bin/raidmode')
raidmode.init(io)
require('./bin/liveSubs')
const webhooks = require('./bin/webhooks')

const publicRoutes = require('./routes/public')(io)
const webhookRoutes = require('./routes/webhooks')
const restrictedRoutes = require('./routes/restricted')(io)

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
// Sitting behind nginx reverse proxy with SSH
app.set('trust proxy', 1)

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
    store: new MongoStore({ mongooseConnection: mongo.connection }),
  })
)
app.use(passport.initialize())
app.use(passport.session())
app.use(express.static(path.join(__dirname, 'public')))

passport.use(
  new TwitchStrategy(
    {
      clientID: config.twitch.app.client_id,
      clientSecret: config.twitch.app.client_secret,
      callbackURL: config.twitch.app.callback_url,
      scope: 'user_read',
    },
    (accessToken, refreshToken, profile, done) => {
      // Only using the twitch id
      // Only using local storage because there is 1 'real' user
      done(null, profile.id.toString())
    }
  )
)

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((user, done) => {
  done(null, user)
})

// Access to mongo in all routes
// Access to IO in all routes
app.use((req, res, next) => {
  req.db = mongo
  req.io = io
  next()
})

// PUBLIC ROUTES FOR NIGHTBOT QUERIES

app.use('/', publicRoutes)

// PUBLIC ROUTES FOR WEBHOOKS

app.use('/webhooks', verifySignature, webhookRoutes)

// ROUTES FOR AUTH

app.get('/auth/twitch', passport.authenticate('twitch'))
app.get(
  '/auth/twitch/callback',
  passport.authenticate('twitch', {
    failureRedirect: '/auth/not_authorized',
  }),
  (req, res) => {
    res.redirect('/')
  }
)

app.use('/auth/not_authorized', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  const err = new Error('Not Authorized')
  err.status = 401
  next(err)
})

// ALL ROUTES PAST HERE ARE AUTHENTICATED TO A TWITCH ID

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development' && !req.user) {
    req.user = '59351240' // Bypass auth when in development as DBKynd
  }
  if (!req.user) return res.redirect('/auth/twitch')
  if (config.allowedToView.indexOf(req.user) === -1)
    return res.redirect('/auth/not_authorized')
  return next()
})

// Force refresh clients if requested by DBKynd
app.get('/forceReload', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  if (req.user !== '59351240') return res.send('Not Authorized')
  io.emit('reload')
  res.send('Page Reload Request Sent.')
})

// Home page routes
app.use('/', restrictedRoutes)

// Set the error status for Not Found
app.use((req, res, next) => {
  const err = new Error('Not Found')
  err.status = 404
  next(err)
})

// Error
app.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.locals.message = err.message
  res.locals.error = {}
  res.status(err.status || 500)
  res.render('error')
})

server.listen(port)
server.on('error', onError)
server.on('listening', onListening)

function normalizePort(val) {
  const portNum = parseInt(val, 10)
  if (isNaN(portNum)) return val
  if (portNum >= 0) return portNum
  return false
}

function onError(error) {
  if (error.syscall !== 'listen') throw error
  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`) // eslint-disable-line no-console
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`) // eslint-disable-line no-console
      process.exit(1)
      break
    default:
      throw error
  }
}

function onListening() {
  const addr = server.address()
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`
  log.info(`Listening on ${bind}`)
}

function verifySignature(req, res, next) {
  const signature = `sha256=${crypto
    .createHmac('sha256', webhooks.secret)
    .update(JSON.stringify(req.body))
    .digest('hex')}`
  req.verified = req.headers['x-hub-signature'] === signature
  next()
}
