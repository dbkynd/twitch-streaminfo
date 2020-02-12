/* global $, document, XMLHttpRequest, window */
let liveSubs
const server =
  window.location.href.includes('127.0.0.1') ||
  window.location.href.includes('localhost')
    ? 'http://127.0.0.1:3000/getLiveSubs'
    : 'https://info.annemunition.tv/getLiveSubs'

$(document).ready(() => {
  httpGetAsync(server, (data) => {
    if (!data) return
    liveSubs = JSON.parse(data)
    $('#live_subs > div').empty()
    const sortable = []
    for (const i in liveSubs) {
      if (liveSubs.hasOwnProperty(i)) {
        sortable.push([i, liveSubs[i]])
      }
    }
    while (sortable.length > 0) {
      const a = sortable.splice(getRandomInt(0, sortable.length), 1)
      addLiveDiv(a[0][0])
    }
  })
})

function httpGetAsync(theUrl, callback) {
  const xmlHttp = new XMLHttpRequest()
  xmlHttp.onreadystatechange = () => {
    if (xmlHttp.readyState === 4 && xmlHttp.status === 200)
      return callback(xmlHttp.responseText)
  }
  xmlHttp.open('GET', theUrl, true)
  xmlHttp.send(null)
}

function addLiveDiv(index) {
  const stream = liveSubs[index]
  if (!stream.game) return
  const newDiv = document.createElement('div')
  newDiv.setAttribute('class', 'live')
  newDiv.setAttribute('data-name', displayName(stream.user))
  $('#live_subs > div').append(newDiv)
  const link = `https://twitch.tv/${stream.user.login}`
  const gameImg = stream.game.box_art_url
    ? stream.game.box_art_url.replace('{width}', 72).replace('{height}', 100)
    : 'https://static-cdn.jtvnw.net/ttv-boxart/Corruption-80x112.jpg'
  const gameLink = stream.game.name
    ? encodeURI(`https://www.twitch.tv/directory/game/${stream.game.name}`)
    : 'https://twitch.tv'
  const previewUrl = stream.thumbnail_url
    .replace('{width}', 640)
    .replace('{height}', 360)
  $(`.live[data-name=${displayName(stream.user)}]`).html(
    `<div class="top"><a href="${link}" target="_blank"><img src="${previewUrl}"></a>` +
      `<div class="game"><div class="tooltip_c"><div class="tooltip">${stream.game.name}</div></div>` +
      `<div class="game_img"><a href="${gameLink}" target="_blank"><img src="${gameImg}"></a></div>` +
      `</div>` +
      `</div>` +
      `<div class="title"><a href="${link}">${stream.title}</a></div>` +
      `<div class="info">${stream.viewer_count} viewers on <span class="channel"><a href="${link}">` +
      `${displayName(stream.user)}</a></span></div>`
  )
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

function displayName(user) {
  if (!user.display_name) return user.login
  if (user.login.toLowerCase() !== user.display_name.toLowerCase()) {
    return user.login
  } else {
    return user.display_name || user.login
  }
}
