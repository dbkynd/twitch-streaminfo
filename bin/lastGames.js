'use strict';
const mongo = require('./mongo');
const log = require('winston');
const debug = require('debug')('streamInfo:lastGame');

debug('Loading lastGame.js');

const gamesToNotSave = [
  'Gaming Talk Shows',
  'Creative',
  'Social Eating',
  'IRL',
  'Music',
  'Games + Demos',
  'The Game Awards',
  'Talk Shows',
  'E3 2018',
  'E3 2019',
  'Just Chatting',
  'Special Events',
];

function mutateName(name) {
  switch (name) {
    case 'PLAYERUNKNOWN\'S BATTLEGROUNDS':
      return 'PUBG';
    default:
      return name;
  }
}

function addGame(game) {
  // Exit if no game data
  if (!game) return;
  // Exit if game is in list of games to not save by name
  if (gamesToNotSave.find(noSave => game.name === noSave)) return;
  mongo.Games.find({}).sort({ _id: -1 })
    .then(async gamesResults => {
      // Exit if the current game is already in the first position
      if (gamesResults[0] && gamesResults[0].id === game.id) return;
      // See if the game is in the list at all
      const matchingRecord = gamesResults.find(g => g.id === game.id);
      if (matchingRecord) {
        // Game in list already, remove it
        await matchingRecord.remove().catch(log.error);
      } else if (gamesResults.length === 5) {
        // We are about to add an entry and the list is already at 5 entries
        // Delete the last entry
        await gamesResults[4].remove().catch(log.error);
      }
      // Create the new game entry
      const entry = new mongo.Games({
        name: game.name,
        id: game.id,
      });
      // Save the new entry
      entry.save().catch(log.error);
    })
    .catch(log.error);
}

module.exports = {
  addGame,
  mutateName,
};
