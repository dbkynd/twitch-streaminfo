const router = require('express').Router() // eslint-disable-line new-cap
const config = require('../config')
const log = require('winston')
const parser = require('../bin/parser')
const googleSheets = require('../bin/googleSheet')

// Main index page
router.get('/', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.render('index', {
    title: config.pageTitle,
    botName: config.botName,
    editor: Boolean(config.allowedToEdit.indexOf(req.user) !== -1),
  })
})

// Angular request to fill tips when loading the page
router.get('/getTips', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  req.db.Tips.find({})
    .sort('-data.created_at')
    .then((results) => {
      res.json(results.map(parser.tip))
    })
    .catch((err) => {
      log.error(err)
      res.sendStatus(503)
    })
})

// Angular request to fill subscribers when loading the page
router.get('/getSubs', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  req.db.Subscriptions.find({})
    .sort('-data.time')
    .then((results) => {
      res.json(results.map(parser.sub))
    })
    .catch((err) => {
      log.error(err)
      res.sendStatus(503)
    })
})

// Angular request to fill cheers when loading the page
router.get('/getCheers', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  req.db.Cheers.find({})
    .sort('-data.time')
    .then((results) => {
      res.json(results.map(parser.cheer))
    })
    .catch((err) => {
      log.error(err)
      res.sendStatus(503)
    })
})

// Angular request to fill queues when loading the page
router.get('/getHosts', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  req.db.Hosts.find({})
    .sort('-data.created_at')
    .then((results) => {
      res.json(results.map(parser.host))
    })
    .catch((err) => {
      log.error(err)
      res.sendStatus(503)
    })
})

// Force crash the process; PM2 will auto restart
router.post('/restart', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  if (config.allowedToEdit.indexOf(req.user) === -1) return res.sendStatus(403)
  res.sendStatus(200)
  process.exit(0)
})

router.post('/saveNote', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  Promise.all([
    new req.db.Notes(req.body).save(),
    googleSheets.saveNote(req.body),
  ])
    .then(() => {
      res.sendStatus(200)
    })
    .catch((err) => {
      log.error(err)
      res.sendStatus(503)
    })
})

module.exports = (io) => {
  router.post('/clearItem', (req, res, next) => {
    // eslint-disable-line no-unused-vars
    if (config.allowedToEdit.indexOf(req.user) === -1)
      return res.sendStatus(403)
    if (!req.body) return res.sendStatus(400)
    let model
    for (const thing in req.db) {
      if (req.db.hasOwnProperty(thing)) {
        if (req.db[thing].modelName === req.body.model) {
          model = req.db[thing]
          break
        }
      }
    }
    if (!model) return res.sendStatus(400)
    model
      .findByIdAndUpdate(req.body.id, { cleared: true }, { upsert: true })
      .then(() => {
        res.sendStatus(200)
        io.emit('clearItem', req.body.id)
      })
      .catch((err) => {
        log.error(err)
        res.sendStatus(503)
      })
  })
  return router
}
