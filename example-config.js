'use strict';
module.exports = {
  port: 3000,
  pageTitle: '',
  botName: '',
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
    },
    ps: {
      id: '',
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
  highlights: {
    googleSheetID: '',
    googleSheetID2: '',
    googleSheetID3: '',
    alterTimeStampSeconds: 40,
  },
};
