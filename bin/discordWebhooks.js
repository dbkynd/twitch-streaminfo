const twitchAPI = require('./twitchAPI')
const axios = require('axios')
const utils = require('./utilities')
const twitchMessages = require('./twitchMessages')
const moment = require('moment')
const config = require('../config')

const { moderationEventWebhookUrl } = config

async function unban(data) {
  const { baneeName, baneeIcon, banearName } = await getInfo(data)
  axios
    .post(moderationEventWebhookUrl, {
      username: 'Unban Event',
      embeds: [
        {
          type: 'rich',
          color: '2123412',
          author: {
            name: `${baneeName} (${data.target_user_id})`,
            url: `https://www.twitch.tv/${data.target}`,
            icon_url: baneeIcon,
          },
          footer: {
            text: `Unbanned by ${banearName}`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    })
    .catch()
}

async function ban(data) {
  const { baneeName, baneeIcon, banearName } = await getInfo(data)
  const messages = (twitchMessages.cache[data.target.toLowerCase()] || [])
    .sort(
      (a, b) =>
        parseInt(a.userstate['tmi-sent-ts']) -
        parseInt(b.userstate['tmi-sent-ts'])
    )
    .map((x) => {
      const time = moment(parseInt(x.userstate['tmi-sent-ts']))
      return `\`\`[${time
        .tz('America/Los_Angeles')
        .format('MM/DD/YY HH:mm:ss')}]\`\` ${x.message}`
    })

  const userData = (await twitchAPI.getUserByIdKraken(data.target_user_id)).body
  const now = new Date().valueOf()
  const createdAt = moment(userData.created_at).valueOf()
  const duration = moment.duration(createdAt - now)
  const registered = `Registered: ${duration.humanize(true)}`

  const embed = {
    type: 'rich',
    color: '11027200',
    author: {
      name: `${baneeName} (${data.target_user_id})`,
      url: `https://www.twitch.tv/${data.target}`,
      icon_url: baneeIcon,
    },
    description: `${registered}\n${messages.join('\n')}`,
    footer: {
      text: `Banned by ${banearName}`,
    },
    timestamp: new Date().toISOString(),
  }
  if (data.reason) {
    embed.fields = [
      {
        name: 'Reason',
        value: data.reason,
      },
    ]
  }

  axios
    .post(moderationEventWebhookUrl, {
      username: 'Ban Event',
      embeds: [embed],
    })
    .catch()

  if (twitchMessages.cache[data.target.toLowerCase()])
    delete twitchMessages.cache[data.target.toLowerCase()]
}

async function getInfo(data) {
  const banee = utils.get(
    ['body', 'data', 0],
    await twitchAPI.getUser(data.target)
  )
  const baneeName = utils.displayName(banee) || data.target
  const baneeIcon = banee
    ? banee.profile_image_url
    : 'https://static-cdn.jtvnw.net/jtv_user_pictures/xarth/404_user_70x70.png'
  const banearName =
    utils.displayName(
      utils.get(['body', 'data', 0], await twitchAPI.getUser(data.created_by))
    ) || data.created_by

  return {
    baneeName,
    baneeIcon,
    banearName,
  }
}

module.exports = {
  ban,
  unban,
}
