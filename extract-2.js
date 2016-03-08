// based on AuditRules.js from Chrome Dev Tools

!function () {

function getAllRules () {
  return Array.from(document.styleSheets)
    .map(sheet => sheet.cssRules)
    .map(rules => rules ? Array.from(rules) : [])
    .flatten()
    .map(r => r.type == 4 ? Array.from(r.cssRules) : r)
    .flatten()
    .filter(r => r.type == 1)
}

var seenRules = new Map()
var allRules = getAllRules()

function getUsedRules () {
  var pseudoSelectorRegexp = /::?(?:[\w-]+)(?:\(.*?\))?/g;

  return allRules
    .filter(r => seenRules.get(r))
    .filter(r => {
      console.log(123)
      var selector = r.selectorText
      var effectiveSelector = selector.replace(pseudoSelectorRegexp, "")
      try {
        // try use maybe corrupted selector
        if (document.querySelector(effectiveSelector))
          return true
      } catch (e) {
        // console.log('corrupted effective selector', [effectiveSelector], ' of original ', [selector],', error:', e)
        // console.log('full rule is:', r.cssText)
        // better take one than loose
        return true
      }
      return document.querySelector(selector)
    })
}

// rulesTree[file_name][media_query][selector] = rule
// {}{}[]
var rulesTree = Object.create(null)

function catchMoreRules () {
  console.log('adding rules…')
  var was = seenRules.size
  getUsedRules()
    .filter(r => seenRules.get(r) ? false : (seenRules.set(r, true), true))
    .each(r => {
      var fileHref = r.parentStyleSheet.href || '.'
      var file = rulesTree[fileHref] // external or local style tag
      if (!file)
        file = rulesTree[fileHref] = Object.create(null)

      var mediaText = ''
      if (r.parentRule && r.parentRule.type == 4) // sits in a media query rule
        mediaText = r.parentRule.media.mediaText
      // return '@media(' + r.parentRule.media.mediaText + '){ ' + r.cssText + ' }'
      var media = file[mediaText]
      if (!media)
        media = file[mediaText] = []

      media.push(r)
    })
  console.log('added', seenRules.size - was)
}

function downloadRules ()
{
  function downloadURI(uri, name) {
    var link = document.createElement("a");
    link.download = name;
    link.href = uri;
    link.click();
  }

  console.log('download rules')
  var css = ''
  for (var fileName in rulesTree) {
    var file = rulesTree[fileName]
    css += '/* ' + fileName + ' */\n'
    for (var mediaName in file) {
      var media = file[mediaName]
      var rules = media.map(r => r.cssText)
      if (mediaName == '') {
        css += rules.join('\n') + '\n'
      } else {
        css += '@media ' + mediaName + ' {\n'
        css += '  ' + rules.join('\n  ') + '\n'
        css += '}\n'
      }
    }
    css += '\n\n'
  }
  downloadURI('data:text/css,' + escape(css), 'style.css')
}

window.addEventListener('keypress', e => {
  if (!e.altKey)
    return

  if (e.code == 'KeyD')
    catchMoreRules()  
  else if (e.code == 'KeyS')
    downloadRules()
})

}()
