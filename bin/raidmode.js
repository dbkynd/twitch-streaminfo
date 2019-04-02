'use strict';
const fetch = require('node-fetch');
const { get, merge } = require('lodash');
const log = require('winston');
const config = require('../config');
const status = require('./status');

function init(io) {
  getCurrentSettings()
    .then(res => {
      const emoteFiltersEnabled = get(res, 'botFilters.emotes.enabled', null);
      if (emoteFiltersEnabled === null) return;
      // Filters ON means Raidmode is OFF
      status.raidMode = !emoteFiltersEnabled;
      log.info(`Got RaidMode data. Enabled: ${status.raidMode}`);
      io.emit('status', { raidMode: status.raidMode });
    });
}

function setFilter(enabled) {
  return new Promise((resolve, reject) => {
    getCurrentSettings()
      .then(res => {
        const body = merge(res, {
          botFilters: {
            emotes: { enabled },
          },
        });
        body.banphrases = body.banphrases.map(x => x._id);
        return fetch(`https://api.streamelements.com/kappa/v2/bot/filters/${config.streamElements.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${config.streamElements.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      })
      .then(res => res.json())
      .then(res => {
        const emoteFiltersEnabled = get(res, 'botFilters.emotes.enabled', null);
        if (emoteFiltersEnabled === enabled) return resolve();
        return reject();
      });
  });
}

function getCurrentSettings() {
  return fetch(`https://api.streamelements.com/kappa/v2/bot/filters/${config.streamElements.id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.streamElements.token}`,
    },
  })
    .then(res => res.json());
}

module.exports = {
  init,
  setFilter,
};
