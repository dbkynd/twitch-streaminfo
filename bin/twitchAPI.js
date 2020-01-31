'use strict';
const config = require('../config');
const request = require('snekfetch');
const log = require('winston');
const debug = require('debug')('streamInfo:twitchAPI');

debug('Loading twitchAPI.js');

module.exports = {
  getUser: identity => {
    const type = /^\d+$/.test(identity) ? 'id' : 'login';
    const url = `https://api.twitch.tv/helix/users?${type}=${identity}`;
    const headers = {
      'Client-ID': config.twitch.app.client_id,
      Authorization: `Bearer ${config.twitch.ps.access_token}`,
    };
    return fetch(url, headers);
  },

  getVideos: (id, type = 'all') => {
    const url = `https://api.twitch.tv/helix/videos?user_id=${id}?type=${type}`;
    const headers = {
      'Client-ID': config.twitch.app.client_id,
      Authorization: `Bearer ${config.twitch.ps.access_token}`,
    };
    return fetch(url, headers);
  },

  getGame: id => {
    const url = `https://api.twitch.tv/helix/games?id=${id}`;
    const headers = {
      'Client-ID': config.twitch.app.client_id,
      Authorization: `Bearer ${config.twitch.ps.access_token}`,
    };
    return fetch(url, headers);
  },

  getTokenData: () => {
    const url = 'https://id.twitch.tv/oauth2/validate';
    const headers = {
      Authorization: `OAuth ${config.twitch.ps.access_token}`,
    };
    return fetch(url, headers);
  },

  getSubscriptions: (offset = 0, limit = 25) => {
    const url = `https://api.twitch.tv/kraken/channels/${config.twitch.id}/subscriptions` +
      `?offset=${offset}&limit=${limit}`;
    const headers = {
      'Client-ID': config.twitch.app.client_id,
      Authorization: `OAuth ${config.twitch.ps.access_token}`,
      Accept: 'application/vnd.twitchtv.v5+json',
    };
    return fetch(url, headers);
  },

  getLiveStreams: idsArray => {
    const url = `https://api.twitch.tv/helix/streams/?type=live${idsArray.map(x => `&user_id=${x}`).join('')}`;
    const headers = {
      'Client-ID': config.twitch.app.client_id,
      Authorization: `Bearer ${config.twitch.ps.access_token}`,
      Accept: 'application/vnd.twitchtv.v5+json',
    };
    return fetch(url, headers);
  },

  getUsers: loginOrIdArray => {
    const query = loginOrIdArray.map(x => {
      const type = /^\d+$/.test(x) ? 'id' : 'login';
      return `&${type}=${x}`;
    }).join('').replace('&', '?');
    const url = `https://api.twitch.tv/helix/users${query}`;
    const headers = {
      'Client-ID': config.twitch.app.client_id,
      Authorization: `Bearer ${config.twitch.ps.access_token}`,
    };
    return fetch(url, headers);
  },

  getGames: ids => {
    const query = ids.map(x => `&id=${x}`).join('').replace('&', '?');
    const url = `https://api.twitch.tv/helix/games${query}`;
    const headers = {
      'Client-ID': config.twitch.app.client_id,
      Authorization: `Bearer ${config.twitch.ps.access_token}`,
    };
    return fetch(url, headers);
  },

  getClip: stub => {
    const url = `https://api.twitch.tv/helix/clips?id=${stub}`;
    const headers = {
      'Client-ID': config.twitch.app.client_id,
      Authorization: `Bearer ${config.twitch.ps.access_token}`,
    };
    return fetch(url, headers);
  },
};

function fetch(url, headers) {
  return new Promise((resolve, reject) => {
    function tryRequest() {
      request.get(url).set(headers || {})
        .then(resolve)
        .catch(error => {
          if (error.body && error.body.status === 429) {
            const resetTime = parseInt(error.headers['ratelimit-reset']) * 1000;
            const ms = resetTime - Date.now() + 500;
            log.error(`TWITCH RATE LIMIT. Retrying in ${ms}ms`);
            setTimeout(tryRequest, ms > 0 ? ms : 500);
          } else {
            reject(error);
          }
        });
    }

    tryRequest();
  });
}
