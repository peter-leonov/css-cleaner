// make all "cross-domain" assets styles local
Array.from(document.getElementsByTagName('link'))
  .forEach(link => { var m = /(\/assets\/.+)/.exec(link.href); if (m) link.href = m[1] })

var children = e => [e].concat(Array.from(e.getElementsByTagName('*')))

var rules = Array.from(document.styleSheets)
  .map(sheet => sheet.cssRules)
  .map(rules => rules ? Array.from(rules) : [])
  .reduce((all, rules) => all.concat(rules), [])
  .filter(r => r.type == 1)
  // select any rules appliable to any of the children
  .filter(r => children($0).some(e => e.querySelector(r.selectorText)) )
  .map(r => r.cssText)
  .sort()

window.prompt('', rules.join('\n'))
