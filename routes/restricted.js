const router = require('express').Router() // eslint-disable-line new-cap
const config = require('../config')
const log = require('winston')
const parser = require('../bin/parser')
const path = require('path')

// Main index page
router.get('/', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  res.render('index', {
    title: config.pageTitle,
    editor: Boolean(config.allowedToEdit.indexOf(req.user) !== -1),
  })
})

// Angular request to fill tips when loading the page
router.get('/getTips', (req, res, next) => {
  // eslint-disable-line no-unused-vars
  req.db.Tips.find({})
    .sort('-data.created_at')
    .then((results) => {
      res.json(results.filter((x) => x.data).map(parser.tip))
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
      res.json(results.filter((x) => x.data).map(parser.sub))
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
      res.json(results.filter((x) => x.data).map(parser.cheer))
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
      res.json(results.filter((x) => x.data).map(parser.host))
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

// SUSPICIOUS FOLLOWER TERM ROUTES
router.get('/terms', (req, res, next) => {
  res.sendFile(path.join(__dirname, '../views/terms.html'))
})

router.get('/term', async (req, res, next) => {
  // get a list of suspicious terms
  const terms = await req.db.SuspiciousTerms.find()
  res.status(200).json(terms)
})

router.post('/term', async (req, res, next) => {
  // add a term to the suspicious terms collection
  let { term } = req.body
  if (!term || term === '') return res.status(400).send('Missing the term.')
  term = term.toLowerCase()
  const existing = await req.db.SuspiciousTerms.findOne({ term })
  if (existing) return res.status(409).send('The term is already registered.')
  const entry = new req.db.SuspiciousTerms({ term })
  entry
    .save()
    .then(() => {
      res.status(200).json(entry)
    })
    .catch(() => {
      res
        .status(500)
        .send('There was an error adding the term to the database.')
    })
})

router.delete('/term', async (req, res, next) => {
  // remove a term from the suspicious terms collection
  const { _id } = req.body
  if (!_id || _id === '')
    return res.status(400).send('Missing the document id.')
  const existing = await req.db.SuspiciousTerms.findById(_id)
  if (!existing) return res.status(409).send('The term was not found.')
  req.db.SuspiciousTerms.findByIdAndRemove(_id)
    .then(() => {
      res.status(200).send('The term was successfully removed.')
    })
    .catch(() => {
      res
        .status(500)
        .send('There was an error removing the term from the database.')
    })
})

router.patch('/term', async (req, res, next) => {
  // update a term from the suspicious terms collection
  let { _id, term } = req.body
  if (!term || term === '') return res.status(400).send('Missing the term.')
  if (!_id || _id === '')
    return res.status(400).send('Missing the document id.')
  term = term.toLowerCase()
  const existing = await req.db.SuspiciousTerms.findById(_id)
  if (!existing) return res.status(409).send('The term was not found.')
  req.db.SuspiciousTerms.findByIdAndUpdate(_id, { term }, { new: true })
    .then((doc) => {
      res.status(200).json(doc)
    })
    .catch(() => {
      res
        .status(500)
        .send('There was an error updating the term in the database.')
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
