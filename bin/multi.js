const multiReg = /https?:\/\/(www\.)?multistre\.am\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/

module.exports = (text) => {
  const match = text.match(multiReg) || []
  if (!match.length) return
  return match[0]
    .toLowerCase()
    .replace(/annemunition\/?/, '')
    .replace(/\/$/, '')
}
