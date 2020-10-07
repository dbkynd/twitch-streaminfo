const utils = require('../utilities')
const moment = require('moment-timezone')

const { determineTimeRage: range } = utils

const dates = {
  startOfLastQ4: moment
    .tz('2019-09-01 00:00:00', 'America/Los_Angeles')
    .valueOf(),
  endOfLastQ4: moment
    .tz('2019-11-30 23:59:59.999', 'America/Los_Angeles')
    .valueOf(),
  startOfQ1: moment.tz('2019-12-01 00:00:00', 'America/Los_Angeles').valueOf(),
  middleOfQ1: moment.tz('2020-01-01 00:00:00', 'America/Los_Angeles').valueOf(),
  endOfQ1: moment
    .tz('2020-02-29 23:59:59.999', 'America/Los_Angeles')
    .valueOf(),
  startOfQ2: moment.tz('2020-03-01 00:00:00', 'America/Los_Angeles').valueOf(),
  middleOfQ2: moment.tz('2020-04-01 00:00:00', 'America/Los_Angeles').valueOf(),
  endOfQ2: moment
    .tz('2020-05-31 23:59:59.999', 'America/Los_Angeles')
    .valueOf(),
  startOfQ3: moment.tz('2020-06-01 00:00:00', 'America/Los_Angeles').valueOf(),
  middleOfQ3: moment.tz('2020-07-01 00:00:00', 'America/Los_Angeles').valueOf(),
  endOfQ3: moment
    .tz('2020-08-31 23:59:59.999', 'America/Los_Angeles')
    .valueOf(),
  startOfQ4: moment.tz('2020-09-01 00:00:00', 'America/Los_Angeles').valueOf(),
  middleOfQ4: moment.tz('2020-10-01 00:00:00', 'America/Los_Angeles'),
  endOfQ4: moment
    .tz('2020-11-30 23:59:59.999', 'America/Los_Angeles')
    .valueOf(),
  startOfNextQ1: moment
    .tz('2020-12-01 00:00:00', 'America/Los_Angeles')
    .valueOf(),
  middleOfNextQ1: moment
    .tz('2021-01-01 00:00:00', 'America/Los_Angeles')
    .valueOf(),
  endOfNextQ1: moment
    .tz('2021-02-28 23:59:59.999', 'America/Los_Angeles')
    .valueOf(),
}

describe('utilities module', () => {
  describe('determineTimeRage method', () => {
    testThing(
      'Q1',
      [dates.startOfQ1, dates.middleOfQ1, dates.endOfQ1],
      [dates.startOfLastQ4, dates.endOfLastQ4, dates.startOfQ1, dates.endOfQ1]
    )

    testThing(
      'Q2',
      [dates.startOfQ2, dates.middleOfQ2, dates.endOfQ2],
      [dates.startOfQ1, dates.endOfQ1, dates.startOfQ2, dates.endOfQ2]
    )

    testThing(
      'Q3',
      [dates.startOfQ3, dates.middleOfQ3, dates.endOfQ3],
      [dates.startOfQ2, dates.endOfQ2, dates.startOfQ3, dates.endOfQ3]
    )

    testThing(
      'Q4',
      [dates.startOfQ4, dates.middleOfQ4, dates.endOfQ4],
      [dates.startOfQ3, dates.endOfQ3, dates.startOfQ4, dates.endOfQ4]
    )

    testThing(
      'Next Q1',
      [dates.startOfNextQ1, dates.middleOfNextQ1, dates.endOfNextQ1],
      [dates.startOfQ4, dates.endOfQ4, dates.startOfNextQ1, dates.endOfNextQ1]
    )
  })
})

function testThing(name, array, expectedArray) {
  describe(name, () => {
    test.each(array)('%s', (date) => {
      Date.now = jest.fn(() => date)
      const {
        startOfLastQuarter,
        endOfLastQuarter,
        startOfQuarter,
        endOfQuarter,
      } = range()
      expect(startOfLastQuarter.valueOf()).toBe(expectedArray[0])
      expect(endOfLastQuarter.valueOf()).toBe(expectedArray[1])
      expect(startOfQuarter.valueOf()).toBe(expectedArray[2])
      expect(endOfQuarter.valueOf()).toBe(expectedArray[3])
    })
  })
}
