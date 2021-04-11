module.exports = {
  port: 3000,
  pageTitle: '',
  allowedToView: [],
  allowedToEdit: [],
  sessionSecret: '',
  mongoUri: '',
  recordsToStore: 25,
  twitch: {
    id: '',
    app: {
      client_id: '',
      client_secret: '',
      callback_url: '',
      access_token: '',
    },
    nick: '',
    oauth: '',
    webHookBaseUrl: '',
  },
  streamElements: {
    id: '',
    token: '',
  },
  minutesBeforeConsideredOffline: 15,
  debug: false,
  lastfm: {
    apiKey: '',
  },
  discord: {
    susFollowerWebhookUrl: '',
    mentionRoleId: '',
  },
  discordUserReportWebhookUrl: '',
  moderationEventWebhookUrl: '',
}
