const multi = require('../multi')

describe('multi response', () => {
  test('single url with text', () => {
    const actual = multi(
      'Watch all the streams: https://multistre.am/AnneMunition/BazingaThatB/im_amethyst/MisMagpie'
    )
    expect(actual).toBe(
      'https://multistre.am/bazingathatb/im_amethyst/mismagpie'
    )
  })

  test('single url no text', () => {
    const actual = multi(
      'https://multistre.am/AnneMunition/BazingaThatB/im_amethyst/MisMagpie'
    )
    expect(actual).toBe(
      'https://multistre.am/bazingathatb/im_amethyst/mismagpie'
    )
  })

  test('Anne in middle of url', () => {
    const actual = multi(
      'Watch all the streams: https://multistre.am/AnneMunition/BazingaThatB/im_amethyst/MisMagpie'
    )
    expect(actual).toBe(
      'https://multistre.am/bazingathatb/im_amethyst/mismagpie'
    )
  })

  test('Anne at end of url', () => {
    const actual = multi(
      'Watch all the streams: https://multistre.am/BazingaThatB/im_amethyst/MisMagpie/AnneMunition'
    )
    expect(actual).toBe(
      'https://multistre.am/bazingathatb/im_amethyst/mismagpie'
    )
  })

  test('Anne at end of url with trailing slash', () => {
    const actual = multi(
      'Watch all the streams: https://multistre.am/BazingaThatB/im_amethyst/MisMagpie/AnneMunition/'
    )
    expect(actual).toBe(
      'https://multistre.am/bazingathatb/im_amethyst/mismagpie'
    )
  })

  test('with squad url', () => {
    const actual = multi(
      'Watch all the streams: https://multistre.am/AnneMunition/BazingaThatB/im_amethyst/MisMagpie or https://www.twitch.tv/annemunition/squad'
    )
    expect(actual).toBe(
      'https://multistre.am/bazingathatb/im_amethyst/mismagpie'
    )
  })
})
