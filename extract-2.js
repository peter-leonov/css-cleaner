// based on AuditRules.js from Chrome Dev Tools

// TODO: remove (rule.parent.remove(rule)) unused rules type 1 from CSSStyleSHeet and then serialize all the document.styleSheets

!function () {

function getAllRules () {
  return Array.from(document.styleSheets)
    .map(sheet => sheet.cssRules)
    .map(rules => rules ? Array.from(rules) : [])
    .flatten()
    .map(r => r.type == 4 ? Array.from(r.cssRules) : r)
    .flatten()
    .filter(r => r.type == 1)
    .map(r => {
      var effectiveSelector = r.selectorText.replace(/::?(?:[\w-]+)(?:\(.*?\))?/g, "")
      try {
        // try use maybe corrupted effective selector
        document.querySelector(effectiveSelector)
      } catch (e) {
        console.log('corrupted effective selector', [effectiveSelector], ' of original ', [r.selectorText],', error:', e)
        console.log('full rule is:', r.cssText)
        // better take the original than loose both
        return {rule: r, selector: r.selectorText}
      }
      // cutting preudos went well, use effective selector
      return {rule: r, selector: effectiveSelector}
    })

}
var $allRules = getAllRules()

var $snapshots = []

var seenRules = new Map()
function catchMoreRules () {
  console.log('adding rules…')
  var used =
    $allRules
    .filter(s => !seenRules.get(s))
    .filter(s => document.querySelector(s.selector))
    .each(s => seenRules.set(s, true))
  $snapshots.push(used)
  console.log('added', used.length)
}


function packRules () {
  console.log('packing rules…')

  // rulesTree[file_name][media_query][selector] = rule
  // {}{}[]
  var rulesTree = Object.create(null)
  $snapshots
    .flatten()
    .map(s => s.rule)
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
  console.log('packed')
  return rulesTree
}

function downloadRules ()
{
  var rulesTree = packRules()

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

new MutationObserver(function(mutations) {
  catchMoreRules()
}).observe(document, { childList: true, attributes: true, subtree: true });

// new MutationObserver(function(mutations) {
//   console.log(mutations[0])
// }).observe(document.documentElement, { childList: true, attributes: true, subtree: true });

}()
