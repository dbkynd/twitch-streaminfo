/* global angular moment window io editor */

const maxListLength = 150

angular
  .module('app', ['btford.socket-io'])
  // API factory for controllers
  .factory('api', ($http) => {
    return {
      getTips: () => $http.get('/getTips'),
      getSubs: () => $http.get('/getSubs'),
      getCheers: () => $http.get('/getCheers'),
      getHosts: () => $http.get('/getHosts'),
      getHours: () => $http.get('/hours'),
      getMulti: () => $http.get('/multi'),
      clearItem: (body) => $http.post('/clearItem', body),
      restart: () => $http.post('/restart', {}),
    }
  })
  .factory('io', (socketFactory) => {
    const loc = window.location
    const wsProtocol = loc.protocol === 'https:' ? 'wss:' : 'ws:'
    return socketFactory({
      ioSocket: io.connect(`${wsProtocol}//${loc.host}${loc.pathname}`),
    })
  })
  // Main controller for the index page
  .controller('indexController', function indexController(
    api,
    $sce,
    $q,
    io,
    $scope,
    $log,
    $timeout,
    $interval
  ) {
    const vm = this // eslint-disable-line
    // Create an object to keep our status info
    vm.status = { app: {}, channel: {} }
    vm.chat = {}
    vm.tips = []
    vm.subs = []
    vm.cheers = []
    vm.hosts = []
    vm.hoursThisQuarter = ''
    vm.hoursLastQuarter = ''

    // Show good websocket connection
    io.on('connect', () => {
      vm.status.websocket = true
    })

    // Show bad websocket connection
    // If the websocket is down we are not getting any other data
    // Show bad connection on all status
    io.on('disconnect', () => {
      vm.status.websocket = false
      for (const key in vm.status.app) {
        if (vm.status.app.hasOwnProperty(key)) {
          vm.status.app[key] = false
        }
      }
    })

    // Got initial status on load or status change update
    io.on('status', (data) => {
      $log.info('status', data)
      angular.merge(vm.status, data)
      vm.followersEnabled =
        vm.status.channel.followersonly !== null &&
        vm.status.channel.followersonly >= 0
      vm.slowEnabled =
        vm.status.channel.slow !== false && vm.status.channel.slow >= 0
    })

    // New tip
    io.on('tip', (tip) => {
      $log.info('TIP', tip)
      vm.tips.unshift(tip)
      if (vm.tips.length > maxListLength) vm.tips.pop()
    })

    // New sub
    io.on('sub', (sub) => {
      $log.info(
        `${sub.type.toUpperCase()} - ${sub.recipientName || sub.name}:`,
        sub
      )
      vm.subs.unshift(sub)
      if (vm.subs.length > maxListLength) vm.subs.pop()
    })

    // New cheer
    io.on('cheer', (cheer) => {
      $log.info('CHEER', cheer)
      vm.cheers.unshift(cheer)
      if (vm.cheers.length > maxListLength) vm.cheers.pop()
    })

    // New host
    io.on('host', (host) => {
      $log.info('HOST', host)
      vm.hosts.unshift(host)
      if (vm.hosts.length > maxListLength) vm.hosts.pop()
    })

    io.on('clearItem', (id) => {
      const tip = vm.tips.find((x) => x._id === id)
      const sub = vm.subs.find((x) => x._id === id)
      const cheer = vm.cheers.find((x) => x._id === id)
      const host = vm.hosts.find((x) => x._id === id)
      if (tip) tip.cleared = true
      if (sub) sub.cleared = true
      if (cheer) cheer.cleared = true
      if (host) host.cleared = true
    })

    io.on('reload', () => {
      $log.info('RELOADING')
      window.location.reload()
    })

    vm.followers = 0

    // New Follower Event
    io.on('following', (data) => {
      vm.followers++
    })

    const array = [
      api.getTips(),
      api.getSubs(),
      api.getCheers(),
      api.getHosts(),
    ]
    $q.all(array)
      .then((results) => {
        vm.tips = results[0].data.slice(0, maxListLength)
        vm.subs = results[1].data.slice(0, maxListLength)
        vm.cheers = results[2].data.slice(0, maxListLength)
        vm.hosts = results[3].data.slice(0, maxListLength)
      })
      .catch($log.error)

    // Click to clear
    vm.clearItem = (item, model) => {
      if (!editor || item.cleared) return
      item.cleared = true
      api.clearItem({ id: item._id, model }).catch($log.error)
    }

    // Click to show tipper's email
    vm.showEmail = (tip) => {
      tip.showEmail = true
    }

    // Format slow mode time to display on page
    vm.slowTime = () => {
      if (!vm.status.channel.slow) return 'Slow Mode'
      let amount = vm.status.channel.slow
      if (amount > 60) {
        amount = `${Math.floor(Math.round(amount / 60))}m`
      } else {
        amount = `${amount}s`
      }
      return `Slow (${amount})`
    }

    // Format followers only time to display on page
    vm.followersonlyTime = () => {
      if (
        !vm.status.channel.followersonly ||
        vm.status.channel.followersonly <= 0
      )
        return 'Followers Only'
      return `Followers (${vm.status.channel.followersonly}m)`
    }

    // Send a command to twitch chat to change the room state
    vm.chatCommand = (command, enabled) => {
      if (!editor) return
      io.emit('chat_command', { command, enabled })
    }

    // Send a command to enable / disable raid mode
    vm.toggleRaidMode = (enable) => {
      if (!editor) return
      io.emit('toggle_raid_mode', enable)
    }

    vm.restart = () => {
      if (!editor) return
      api.restart().catch($log.error)
    }

    vm.year = (months) => {
      const dif = parseInt(months) % 12
      if (dif === 0) {
        const years = parseInt(months) / 12
        return `${years} year${years === 1 ? '' : 's'}`
      }
      return null
    }

    vm.anyStatus = () => {
      for (const key in vm.status.app) {
        if (vm.status.app.hasOwnProperty(key)) {
          if (vm.status.app[key] !== true) return true
        }
      }
      return false
    }

    // Function to parse injected html text
    vm.toTrustedHTML = (html) => $sce.trustAsHtml(html)

    vm.time = (timestamp) =>
      moment.unix(timestamp / 1000).format('h:mma M/D/YY')

    vm.hostAmount = (amount) => {
      if (amount === 'true' || amount === true) return 1
      return amount
    }

    vm.openMulti = () => {
      api.getMulti().then((res) => {
        window.open(res.data, '_blank')
      })
    }

    checkHours()
    $interval(checkHours, 1000 * 60 * 20)

    function checkHours() {
      api.getHours().then(({ data }) => {
        vm.hoursThisQuarter = data.thisQuarter
        vm.hoursLastQuarter = data.lastQuarter
      })
    }
  })
