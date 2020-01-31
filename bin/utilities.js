const log = require('winston')
const config = require('../config')
const debug = require('debug')('streamInfo:utilities')

debug('Loading utilities.js')

module.exports = {
  get: (p, o) => p.reduce((xs, x) => (xs && xs[x] ? xs[x] : null), o),

  displayName: (user, displayName) => {
    if (!user) return null
    if (displayName) {
      user = {
        login: user,
        display_name: displayName,
      }
    }
    if (!user.display_name) return user.login
    if (user.login.toLowerCase() !== user.display_name.toLowerCase()) {
      return user.login
    } else {
      return user.display_name || user.login
    }
  },

  trimDB: async (model) => {
    const count = await model.count({}).catch(log.error)
    if (count > config.recordsToStore) {
      for (let i = 1; i <= count - config.recordsToStore; i++) {
        debug('Removing a record from the database')
        ;(await model.findOne({}).sort('_id')).remove().catch(log.error)
      }
    }
  },

  getRandomIntInclusive: (min, max) => {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
  },
}
