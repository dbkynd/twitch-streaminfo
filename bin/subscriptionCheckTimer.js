const twitchAPI = require('./twitchAPI')
const debug = require('debug')('streamInfo:subscriptionCheckTimer')
const { Subscriptions } = require('mongo')

let _io
const subs = {}

function addUser(id) {
  if (subs[id]) return
  subs[id] = setTimeout(() => {
    delete subs[id]
  }, 1000 * 60 * 11)
}

async function checkForSubscriptions() {
  const ids = Object.keys(subs)
  if (!ids.length) return
  const users = ids.map((x) => `user_id=${x}`).join('&')
  const { body } = await twitchAPI.checkSubscriptions(users)
  const subbedIds = body.data.map((x) => x.user_id)
  const notSubscribed = ids.filter((x) => !subbedIds.includes(x))
  if (!notSubscribed.length) return
  if (_io) _io.emit('sub_removal_list', notSubscribed)
  for (let i = 0; i < notSubscribed.length; i++) {
    delete subs[notSubscribed[i]]
    const entry = await Subscriptions.findOne({ 'data.id': notSubscribed[i] })
    if (entry) {
      entry.removed = true
      await Subscriptions.findOneAndUpdate(
        { 'data.id': notSubscribed[i] },
        entry
      )
    }
  }
}

module.exports = (io) => {
  debug('Starting subscriptionCheckTimer.js')

  _io = io
  setInterval(checkForSubscriptions, 1000 * 60)

  return {
    addUser,
  }
}
