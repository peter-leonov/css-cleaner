// based on AuditRules.js from Chrome Dev Tools

// sorry for the PHP-style code, I promise to use functional programming next time ;)

!function () {

function walkRules (rules) {
  var result = []
  if (!rules)
    return result
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i]
    if (rule.type == 4) {
      result = result.concat(walkRules(rule.cssRules))
      continue
    }
    result.push(rule)
  }
  return result
}

var $allRulesOfAllTypes =
  Array.from(document.styleSheets)
  .map(sheet => walkRules(sheet.cssRules))
  .flatten() // replace with reduce for production

var $allStyleRules = $allRulesOfAllTypes.filter(r => r.type == 1)

var $usedRules = new Map()
function markAsUsed (rule) {
  $usedRules.set(rule, true)
}
function isUsed (rule) {
  return $usedRules.get(rule)
}

function getEffectiveRules () {
  return $allStyleRules
    .map(rule => {
      var effectiveSelector = rule.selectorText.replace(/::?(?:[\w-]+)(?:\(.*?\))?/g, "")
      try {
        // try use maybe corrupted effective selector
        document.querySelector(effectiveSelector)
      } catch (e) {
        console.log('corrupted effective selector', [effectiveSelector], ' of original ', [rule.selectorText],', error:', e)
        console.log('full rule is:', rule.cssText)
        // better mark the original as used than loose it
        markAsUsed(rule)
        return null
      }
      // cutting preudos went well, use effective selector
      return {rule: rule, selector: effectiveSelector}
    })
    .filter(rule => rule) // remove nulls

}
var $effectiveRules = getEffectiveRules()

var $snapshots = []

var seenEffectiveRules = new Map()
function catchMoreRules () {
  console.log('adding rules…')
  var used =
    $effectiveRules
    .filter(s => !seenEffectiveRules.get(s))
    .filter(s => document.querySelector(s.selector))
    .each(s => seenEffectiveRules.set(s, true))
  $snapshots.push(used)
  console.log('added', used.length)
}


function gcRules () {
  console.log('GCing rules…')
  $snapshots
    .flatten()
    .map(s => s.rule)
    .each(rule => markAsUsed(rule))

  $allStyleRules.each(rule => {
    if (isUsed(rule))
      return
    if (!rule.parentStyleSheet) // already deleted
      return
    rule.parentStyleSheet.removeRule(rule)
  })
  console.log('GCed')
}
function renderRules () {
  var css = ''
  Array.from(document.styleSheets).each(ss => {
    css += '/* ' + (ss.href || '.') +' */\n'
    Array.from(ss.cssRules || []).each(rule => {
      css += rule.cssText + '\n'
    })
    css += '\n'
  })
  return css
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
  gcRules()
  var css = renderRules()
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
