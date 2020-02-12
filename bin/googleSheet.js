const GoogleSpreadsheet = require('google-spreadsheet')
const log = require('winston')
const config = require('../config')
const moment = require('moment-timezone')
const stream = require('./stream')()
const utils = require('./utilities')
const twitchAPI = require('../bin/twitchAPI')
const debug = require('debug')('streamInfo:googleSheet')
require('moment-timezone')

debug('Loading googleSheet.js')

const my_sheet = new GoogleSpreadsheet(config.highlights.googleSheetID)
const my_sheet2 = new GoogleSpreadsheet(config.highlights.googleSheetID2)
const my_sheet3 = new GoogleSpreadsheet(config.highlights.googleSheetID3)
const my_sheet_creds = require('../google_creds.json')

function saveHighlight(query, user) {
  return new Promise(async (resolve, reject) => {
    const status = stream.status
    const body = status.isHosting ? status.targetBody : status.body
    if (!body) return resolve('The stream is offline. Unable to save.')
    const videos = utils.get(
      ['body', 'data'],
      await twitchAPI.getVideos(body.user_id)
    )
    const recording = videos
      ? videos.find((x) => x.created_at >= body.started_at)
      : null
    const streamData = await getStreamData(body)
    const link = recording
      ? `${recording.url}?t=${streamData.clipStart}`
      : 'Unable to locate past broadcast URL'
    const data = {
      body,
      streamData,
      notes: `${user}: ${query}`,
      link,
    }
    addLine(data)
      .then(() => {
        const hosted = status.isHosting ? 'hosted ' : ''
        resolve(
          `That ${hosted}'${streamData.game.name}' moment was saved. PogChamp${
            link ? ` ${link}` : ''
          }`
        )
      })
      .catch(reject)
  })
}

async function getStreamData(body) {
  const game = await stream.getGameData(body.game_id)
  const streamStart = moment(body.started_at)
    .tz('America/Los_Angeles')
    .format('YYYY-MM-DD h:mma z')
  const d = moment.duration(
    moment() -
      moment(body.started_at).add(config.highlights.alterTimeStampSeconds, 's')
  )._data
  const clipStart = `${d.days * 24 + d.hours}h${`0${d.minutes}`.slice(
    -2
  )}m${`0${d.seconds}`.slice(-2)}s`
  return {
    game,
    streamStart,
    clipStart,
  }
}

function addLine(data) {
  return new Promise((resolve, reject) => {
    my_sheet.useServiceAccountAuth(my_sheet_creds, (error) => {
      if (error) return reject(error)
      my_sheet.addRow(
        1,
        {
          'Date Added': moment()
            .tz('America/Los_Angeles')
            .format('YYYY-MM-DD h:mma z'),
          'Stream Start Time': data.streamData.streamStart,
          Game: data.streamData.game.name,
          Link: data.link,
          Notes: data.notes,
          'Stream Title': data.body.title,
          'Clip Start Time': data.streamData.clipStart,
        },
        (err) => {
          if (err) return reject(err)
          resolve()
        }
      )
    })
  })
}

function updateSubscriberDataSheet(reportedSubsLength, subscribersChunksArray) {
  my_sheet2.useServiceAccountAuth(my_sheet_creds, (authErr) => {
    if (authErr) return log.error(authErr)
    my_sheet2.getInfo((infoErr, info) => {
      if (infoErr) return log.error(infoErr)
      const sheet = info.worksheets[0]
      sheet.getCells(
        {
          'min-row': 1,
          'max-row': 15,
          'min-col': 2,
          'max-col': 2,
          'return-empty': true,
        },
        (cellErr, cells) => {
          if (cellErr) return log.error(cellErr)
          const subscribers = subscribersChunksArray.reduce(
            (prev, curr) => prev.concat(curr),
            []
          )
          const data = {
            prime: 0,
            tier1000: 0,
            tier2000: 0,
            tier3000: 0,
            gifted1000: 0,
            gifted2000: 0,
            gifted3000: 0,
          }
          subscribers.forEach((x) => {
            if (x.sub_plan === 'Prime') {
              data.prime++
            } else {
              data[`tier${x.sub_plan}`]++
            }
            if (x.is_gift) data[`gifted${x.sub_plan}`]++
          })
          cells[0].value = moment()
            .tz('America/Los_Angeles')
            .format('YYYY-MM-DD h:mma z')
          cells[2].value = reportedSubsLength
          cells[3].value = subscribers.length
          cells[6].value = data.prime
          cells[7].value = data.tier1000 - data.gifted1000 - data.prime
          cells[8].value = data.tier2000 - data.gifted2000
          cells[9].value = data.tier3000 - data.gifted3000
          cells[10].value = data.gifted1000
          cells[11].value = data.gifted2000
          cells[12].value = data.gifted3000
          sheet.bulkUpdateCells(cells, (saveErr) => {
            if (saveErr) log.error(saveErr)
          })
        }
      )
    })
  })
}

function saveNote(data) {
  return new Promise((resolve, reject) => {
    my_sheet3.useServiceAccountAuth(my_sheet_creds, (error) => {
      if (error) return reject(error)
      my_sheet3.addRow(
        1,
        {
          Date: moment(data.date)
            .tz('America/Los_Angeles')
            .format('MM-DD-YYYY h:mma z'),
          Note: data.note,
        },
        (err) => {
          if (err) return reject(err)
          resolve()
        }
      )
    })
  })
}

module.exports = {
  saveHighlight,
  updateSubscriberDataSheet,
  saveNote,
}
