const Report = require('./mongo').DiscordUserReports
const config = require('../config')
const Discord = require('discord.js')

const [, hookId, hookToken] = config.discordUserReportWebhookUrl.match(
  /https:\/\/discordapp\.com\/api\/webhooks\/(\d+)\/(.*)/
)
const hook = new Discord.WebhookClient(hookId, hookToken)

const urlRegEx = /(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g

module.exports = async ({ body, files }) => {
  const { reporter, reported, message } = body

  const entry = await new Report({
    reporter,
    reported,
    message,
  }).save()

  const attachments = files.map((f) => {
    return {
      attachment: f.buffer,
      name: f.originalname,
    }
  })

  await hook.send(`@ here\n\n${message.replace(urlRegEx, '<$1>')}`, {
    username: `REPORT #${entry.id} | From: ${reporter} | Against: ${reported}`,
    allowedMentions: {
      parse: [],
    },
    files: attachments,
  })
}
