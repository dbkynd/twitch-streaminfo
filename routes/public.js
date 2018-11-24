'use strict';
const router = require('express').Router(); // eslint-disable-line new-cap
const uptime = require('../bin/uptime');
const games = require('../bin/lastGames');
const googleSheet = require('../bin/googleSheet');
const moment = require('moment');
const log = require('winston');
const liveSubs = require('../bin/liveSubs');
const raidmode = require('../bin/raidmode');
const report = require('../bin/report');
const status = require('../bin/status');
require('moment-timezone');

router.get('/uptime', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.send(uptime.getUptime());
});

router.get('/timestamp', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.send(uptime.getTimestamp());
});

router.get('/games', (req, res, next) => { // eslint-disable-line no-unused-vars
  req.db.Games.find({}).sort({ _id: -1 })
    .then(gameResults => {
      if (gameResults.length > 0) {
        res.send(`The last played games are: ${gameResults.map(g => games.mutateName(g.name)).join(' | ')}`);
      } else {
        res.send('No games have been saved.');
      }
    })
    .catch(() => {
      res.sendStatus(503);
    });
});

router.get('/highlight', (req, res) => {
  const query = req.query.q || '';
  const user = req.query.u || '';
  googleSheet.saveHighlight(query, user)
    .then(response => {
      res.send(response);
    })
    .catch(err => {
      log.error(err);
      res.send('There was an error saving that moment. BibleThump');
    });
});

router.get('/latestSub', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.render('latestSub');
});

router.get('/latestTip', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.render('latestTip');
});

router.get('/latestCheer', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.render('latestCheer');
});

router.get('/time', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.send(`Anne's clock reads: ${moment.tz('America/Los_Angeles').format('ddd, h:mma zz')}`);
});

router.get('/getLiveSubs', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(liveSubs.getCurrentlyLive());
});

router.get('/getLiveSubsCount', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.send(liveSubs.getCurrentlyLive().length.toString());
});

router.get('/whatNow', async (req, res, next) => { // eslint-disable-line no-unused-vars
  const countRecord = await req.db.Counts.findOne({ name: 'liveSubs' });
  const oldCount = countRecord ? countRecord.count : 0;
  const currentCount = liveSubs.getCurrentlyLive().length;
  let str;
  if (currentCount > oldCount) {
    str = `${currentCount} of Anne's subscribers are currently live. ` +
      `Find out who at: http://annemunition.tv/armory NEW RECORD! PogChamp`;
    if (countRecord) {
      countRecord.count = currentCount;
      countRecord.save();
    } else {
      const newCount = new req.db.Counts({
        name: 'liveSubs',
        count: currentCount,
      });
      newCount.save();
    }
  } else {
    str = `${currentCount} of Anne's subscribers are currently live. Find out who at: http://annemunition.tv/armory`;
  }
  res.send(str);
});

router.get('/liveSubs', (req, res, next) => { // eslint-disable-line no-unused-vars
  res.render('liveSubs', {});
});

router.get('/allCleared', async (req, res, next) => { // eslint-disable-line no-unused-vars
  const tips = await req.db.Tips.count({ cleared: false });
  const subs = await req.db.Subscriptions.count({ cleared: false });
  const cheers = await req.db.Cheers.count({ cleared: false });
  res.json((tips + subs + cheers) === 0);
});

// Report a user on Twitch
router.get('/report/:name', async (req, res) => {
  // Extract the username
  const name = req.params.name.toLowerCase();
  // Send the user to the twitch report page right away
  res.redirect(`https://www.twitch.tv/${name}/report`);
  await report.newReport(name);
});

router.get('/reported', async (req, res) => {
  // Return a JSON formatted list of all those currently in the report list
  const reported = await req.db.Reported.find();
  res.json(reported || []);
});

router.get('/reported/purge', (req, res) => {
  // Remove all documents from the report collection
  req.db.Reported.remove({}).exec()
    .then(() => {
      res.sendStatus(200);
    })
    .catch(() => {
      res.sendStatus(503);
    });
});

router.get('/reported/purge/:name', async (req, res) => {
  // Find the user if exists
  req.db.Reported.findOne({ username: req.params.name })
    .then(user => {
      // Return 404 if no user found
      if (!user) return res.sendStatus(404);
      // Remove the user
      user.remove()
        .then(() => {
          // Return OK
          res.sendStatus(200);
        });
    })
    .catch(() => {
      // Return Error
      res.sendStatus(503);
    });
});

module.exports = io => {
  router.get('/sub_games_advance_queue', (req, res, next) => { // eslint-disable-line no-unused-vars
    // Forbidden if nightbot response url is not passed in headers
    if (!req.headers['nightbot-response-url']) return res.sendStatus(403);
    res.send(' ');
    io.emit('sub_games_advance_queue', req.headers);
  });

  router.get('/raidmode', (req, res) => {
    const action = req.query.q || 'on';
    switch (action.toLowerCase()) {
      case 'on':
      case 'enable':
        toggle(true);
        break;
      case 'off':
      case 'disable':
        toggle(false);
        break;
      default:
        return res.sendStatus(400);
    }

    function toggle(enabled) {
      raidmode.setFilter(!enabled)
        .then(() => {
          status.raidMode = enabled;
          log.info(`RaidMode set. Enabled: ${status.raidMode}`);
          io.emit('status', { raidMode: status.raidMode });
          res.status(200).send(`Raidmode has been ${enabled ? 'enabled' : 'disabled'}.`);
        })
        .catch(err => {
          log.error(err);
          res.status(200).send(`There was an error ${enabled ? 'enabling' : 'disabling'} Raidmode.`);
        });
    }
  });

  return router;
};
