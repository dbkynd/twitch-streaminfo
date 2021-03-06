const debug = require('debug')('streamInfo:twitchMessages')
const twitchApi = require('../bin/twitchAPI')
const { get } = require('lodash')
const config = require('../config')
const { ClipChannels } = require('../bin/mongo')

debug('Loading twitchMessages.js')

const messageCache = {}
const clipsReg = /clips\.twitch\.tv\/([\w-]+)|twitch.tv\/\w+\/clip\/([\w-]+)/
const permitted = new Map()

function process(channel, userstate, message, io, twitch) {
  // eslint-disable-line no-unused-vars
  banNotify(channel, userstate, message)
  clipsDeletion(channel, userstate, message, twitch).catch()
  permit(channel, userstate, message).catch()
}

async function permit(channel, userstate, message) {
  // Exit if message not starting with !
  if (!message.startsWith('!')) return
  // Exit if not a permit message
  if (!message.toLowerCase().startsWith('!permit')) return
  // Get the username of the user we want to permit
  const user = message
    .toLowerCase()
    .replace('!permit', '')
    .trim()
    .split(' ')[0]

  // Get the user data from Twitch
  const userData = await twitchApi.getUser(user)
  // Extract the user id
  const id = get(userData, 'body.data[0].id', null)
  if (!id) return

  // If we are already permit this user
  // clear the timer and delete the record
  // so it can be remade with a fresh timer
  if (permitted.has(id)) {
    clearTimeout(permitted.get(id))
    permitted.delete(id)
  }

  // Store the permission and have it clear after 60 seconds
  permitted.set(
    id,
    setTimeout(() => {
      if (permitted.has(id)) {
        permitted.delete(id)
      }
    }, 1000 * 60)
  )
}

function banNotify(channel, userstate, message) {
  const name = userstate.username.toLowerCase()
  if (!messageCache[name]) messageCache[name] = []
  messageCache[name].push({ userstate, message })
  if (messageCache[name].length > 10) messageCache[name].shift()
}

async function clipsDeletion(channel, userstate, message, twitch) {
  const isBroadcaster = get(userstate, 'badges.broadcaster', null)
  const isModerator = get(userstate, 'badges.moderator', null)
  const isVip = get(userstate, 'badges.vip', null)
  // const isSubscriber = get(userstate, 'badges.subscriber', null)
  // Return if anybody besides non-subscribers
  if (isBroadcaster || isModerator || isVip) return
  // Return if the user is currently permitted
  if (permitted.has(userstate['user-id'])) return
  // Return if the message does not contain a clip
  if (!clipsReg.test(message)) return
  // Extract the clip stub from the message
  const match = message.match(clipsReg)
  const stub = match[2] || match[1]
  // Return if no stub was found
  if (!stub) return
  // Query the Twitch API for the clip data
  const clipData = await twitchApi.getClip(stub)
  // Extract the clip channel id from the clip data
  const clipChannelId = get(clipData, 'body.data[0].broadcaster_id', null)
  // Return if the clip id matches the broadcasters id
  if (clipChannelId === config.twitch.id) return
  // Check the database if the clips channel id is allowed
  const allowed = await ClipChannels.findOne({ channelId: clipChannelId })
  // Return if we found a match
  if (allowed) return
  // Delete the message containing the clip we don't allow
  twitch.deletemessage(channel, userstate.id)
}

module.exports = {
  process,
  cache: messageCache,
}
