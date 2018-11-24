'use strict';
const mongo = require('./mongo');
const twitchAPI = require('./twitchAPI');
const utils = require('./utilities');
const debug = require('debug')('streamInfo:twitchDB');

debug('Loading twitchDB.js');

function getUsers(ids) {
  return new Promise(async (resolve, reject) => {
    // Make array if single item
    if (!Array.isArray(ids)) ids = [ids];
    // Remove duplicates
    ids = Array.from(new Set(ids)); // eslint-disable-line no-undef
    debug(`Searching database for info on ${ids.length} users`);
    // Get all the users we can from our database
    const usersInDatabase = await mongo.TwitchUsers.find({ twitchId: { $in: ids } });
    if (usersInDatabase === null) reject();
    // Make an array of just ids for easier searching
    const usersInDatabaseIdsArray = usersInDatabase.map(x => x.twitchId);
    debug(`Database held info on ${usersInDatabase.length} users`);
    const time = Date.now();
    // Get user ids not in the database or expired
    const usersToLookup = ids.filter(id => usersInDatabaseIdsArray.indexOf(id) === -1 ||
      usersInDatabase.find(x => x.twitchId === id).expires <= time);
    if (usersToLookup.length > 0) debug(`${usersToLookup.length} users do not exist or are expired`);
    // Get missing user data from twitch
    const twitchResults = usersToLookup.length > 0 ?
      utils.get(['body', 'data'], await twitchAPI.getUsers(usersToLookup)) : [];
    if (twitchResults === null) reject();
    if (usersToLookup.length > 0) debug(`Got twitch data on ${twitchResults.length} users`);
    // Delete expired docs from database
    const expiredDocs = usersInDatabase.filter(x => x.expires <= time).map(x => x.twitchId);
    if (expiredDocs.length > 0) {
      await mongo.TwitchUsers.deleteMany({ twitchId: { $in: expiredDocs } });
      debug(`Removed ${usersToLookup.length} expired users from the database`);
    }
    // Create new docs
    const docs = twitchResults.map(x => new mongo.TwitchUsers({ twitchId: x.id, data: x }));
    // Save new docs
    const saved = docs.length > 0 ? await mongo.TwitchUsers.insertMany(docs, { new: true }) : [];
    debug(`Saved ${saved.length} users to the database`);
    const unexpiredDocs = usersInDatabase.filter(x => x.expires > time);
    resolve(unexpiredDocs.concat(saved));
  });
}

function getGames(ids) {
  return new Promise(async (resolve, reject) => {
    // Make array if single item
    if (!Array.isArray(ids)) ids = [ids];
    // Remove duplicates
    ids = Array.from(new Set(ids)); // eslint-disable-line no-undef
    debug(`Searching database for info on ${ids.length} games`);
    // Get all the games we can from our database
    const gamesInDatabase = await mongo.TwitchGames.find({ twitchId: { $in: ids } });
    if (gamesInDatabase === null) reject();
    // Make an array of just ids for easier searching
    const gamesInDatabaseIdsArray = gamesInDatabase.map(x => x.twitchId);
    debug(`Database held info on ${gamesInDatabase.length} games`);
    const time = Date.now();
    // Get game ids not in the database or expired
    const gamesToLookup = ids.filter(id => gamesInDatabaseIdsArray.indexOf(id) === -1 ||
      gamesInDatabase.find(x => x.twitchId === id).expires <= time);
    if (gamesToLookup.length > 0) debug(`${gamesToLookup.length} games do not exist or are expired`);
    // Get missing game data from twitch
    const twitchResults = gamesToLookup.length > 0 ?
      utils.get(['body', 'data'], await twitchAPI.getGames(gamesToLookup)) : [];
    if (twitchResults === null) reject();
    if (gamesToLookup.length > 0) debug(`Got twitch data on ${twitchResults.length} games`);
    // Delete expired docs from database
    const expiredDocs = gamesInDatabase.filter(x => x.expires <= time).map(x => x.twitchId);
    if (expiredDocs.length > 0) {
      await mongo.TwitchGames.deleteMany({ twitchId: { $in: expiredDocs } });
      debug(`Removed ${gamesToLookup.length} expired games from the database`);
    }
    // Create new docs
    const docs = twitchResults.map(x => new mongo.TwitchGames({ twitchId: x.id, data: x }));
    // Save new docs
    const saved = docs.length > 0 ? await mongo.TwitchGames.insertMany(docs, { new: true }) : [];
    debug(`Saved ${saved.length} games to the database`);
    const unexpiredDocs = gamesInDatabase.filter(x => x.expires > time);
    resolve(unexpiredDocs.concat(saved));
  });
}

module.exports = {
  getGames,
  getUsers,
};
