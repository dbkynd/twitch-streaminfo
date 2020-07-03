const emojione = require('emojione')
const moment = require('moment')
const getSymbolFromCurrency = require('currency-symbol-map')
const utils = require('./utilities')
const emoteCache = require('./emoteCache')

emojione.ascii = true

module.exports = {
  cheer: (entry) => {
    if (!entry || !entry.data) return
    const message = entry.data.message
    const bttvEmotes = parseEmotes(message, emoteCache.bttvEmotes())
    const twitchEmotes = parseEmotes(message, emoteCache.twitchEmotes())
    const cheerActions = parseCheerActions(message, emoteCache.cheerActions())
    const emotes = [].concat(bttvEmotes, twitchEmotes, cheerActions)
    return {
      _id: entry._id,
      cleared: entry.cleared,
      name: utils.displayName(entry.data.username, entry.data['display-name']),
      timestamp: getTimestamp(entry.data['tmi-sent-ts']),
      message: parseEmojiOne(processEmotes(message, emotes)),
      amount: entry.data.bits,
    }
  },
  host: (entry) => {
    if (!entry || !entry.data) return
    return {
      _id: entry._id,
      cleared: entry.cleared,
      name: entry.data.username,
      viewers: entry.data.viewers,
      timestamp: getTimestamp(entry.data.created_at),
      isRaid: entry.isRaid,
    }
  },
  sub: (entry) => {
    if (!entry || !entry.data) return
    const message = entry.data.message
    const bttvEmotes = parseEmotes(message, emoteCache.bttvEmotes())
    const twitchEmotes = parseEmotes(message, emoteCache.twitchEmotes())
    const emotes = [].concat(bttvEmotes, twitchEmotes)
    let recipients = null
    if (entry.data['msg-id'] === 'submysterygift' && entry.recipients) {
      recipients = entry.recipients.map((recipient) => {
        const months = count(recipient['msg-param-cumulative-months'])
        return {
          name: utils.displayName(
            recipient['msg-param-recipient-user-name'],
            recipient['msg-param-recipient-display-name']
          ),
          months: months > 1 ? months : 'NEW',
        }
      })
    }
    const months = count(entry.data['msg-param-cumulative-months'])
    const showStreak = boolean(entry.data['msg-param-should-share-streak'])
    return {
      _id: entry._id,
      cleared: entry.cleared,
      type: entry.data['msg-id'],
      name: utils.displayName(entry.data.login, entry.data['display-name']),
      recipientName: utils.displayName(
        entry.data['msg-param-recipient-user-name'],
        entry.data['msg-param-recipient-display-name']
      ),
      months: months > 1 ? `${months} months` : 'NEW SUB',
      tier: getTier(entry.data['msg-param-sub-plan']),
      tierAmount: getTierAmount(entry.data['msg-param-sub-plan']),
      isPrime: entry.data['msg-param-sub-plan'] === 'Prime',
      timestamp: getTimestamp(entry.data['tmi-sent-ts']),
      message: parseEmojiOne(processEmotes(message, emotes)),
      recipients,
      giftCount: count(entry.data['msg-param-mass-gift-count']),
      streak: showStreak ? count(entry.data['msg-param-streak-months']) : null,
      giftMonths: count(entry.data['msg-param-gift-months']),
    }
  },
  tip: (entry) => {
    if (!entry || !entry.data) return
    const message = entry.data.message
    const bttvEmotes = parseEmotes(message, emoteCache.bttvEmotes())
    const twitchEmotes = parseEmotes(message, emoteCache.twitchEmotes())
    const emotes = [].concat(bttvEmotes, twitchEmotes)
    return {
      _id: entry._id,
      cleared: entry.cleared,
      name: entry.data.username,
      timestamp: getTimestamp(entry.data.created_at),
      message: parseEmojiOne(processEmotes(message, emotes)),
      amount: `${getSymbolFromCurrency(entry.data.currency)}${
        entry.data.amount
      }`,
      email: entry.data.email,
    }
  },
}

function parseCheerActions(message, actions) {
  if (!message) return null
  if (!actions) return []
  const actionArray = []
  const prefixes = actions.map((x) => x.prefix)
  const reg = new RegExp(`\\b(${prefixes.join('|')})([0-9]{1,10})\\b`, 'ig')
  let result
  while ((result = reg.exec(message))) {
    const tiers = actions
      .find((x) => x.prefix.toLowerCase() === result[1].toLowerCase())
      .tiers.sort((a, b) => a.min_bits - b.min_bits)
    let tier
    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i].min_bits > parseInt(result[2])) {
        tier = tiers[i - 1]
        break
      }
    }
    if (!tier) tier = tiers.reverse()[0]
    actionArray.push({
      code: result[0],
      start: result.index,
      end: reg.lastIndex - 1,
      url: tier.images.dark.static['2'],
      bits: result[2],
    })
  }
  return actionArray
}

function parseEmotes(message, emotes) {
  if (!message || !emotes) return []
  const wordArray = message.split(' ')
  const emotesArray = []
  wordArray.forEach((word) => {
    if (emotes[word] && !emotesArray.find((x) => x.code === word)) {
      const r = new RegExp(`\\b${word}\\b`, 'g')
      let result
      while ((result = r.exec(message))) {
        emotesArray.push({
          code: word,
          start: result.index,
          end: r.lastIndex - 1,
          url: emotes[word].url,
        })
      }
    }
  })
  return emotesArray
}

function processEmotes(message, emotes) {
  if (!message) return null
  if (!emotes) return message
  const chars = message.split('')
  emotes.forEach((emote) => {
    if (!emote.url) return
    for (let i = emote.start; i <= emote.end; i++) {
      delete chars[i]
    }
    chars[
      emote.start
    ] = `<img title="${emote.code}" class="emote" src="${emote.url}">`
  })
  return chars.filter((x) => x).join('')
}

function parseEmojiOne(message) {
  if (!message) return null
  return emojione.toImage(message)
}

function getTimestamp(date) {
  let mom
  if (!date) mom = moment()
  else if (/^\d+$/.test(date)) mom = moment.unix(date / 1000)
  else mom = moment(date)
  return mom.valueOf()
}

function getTier(value) {
  switch (value) {
    case '3000':
      return 'Tier 3'
    case '2000':
      return 'Tier 2'
    default:
      return 'Tier 1'
  }
}

function getTierAmount(value) {
  switch (value) {
    case '3000':
      return '$25'
    case '2000':
      return '$10'
    default:
      return ''
  }
}

function count(value) {
  if (value === true) return 1
  return value
}

function boolean(value) {
  if (value === 'true') return true
  if (value === '1') return true
  if (value === 1) return true
  if (value === true) return true
  return false
}
