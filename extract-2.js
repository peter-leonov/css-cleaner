// based on AuditRules.js from Chrome Dev Tools

// sorry for the PHP-style code, I promise to use functional programming next time ;)

!function () {

function walkRules (rules) {
  var result = []
  if (!rules)
    return result
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i]
    result.push(rule)
    if (rule.type == 4) {
      result = result.concat(walkRules(Array.from(rule.cssRules)))
      continue
    }
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

function catchMoreRules () {
  console.log('adding rules…')
  var was = $usedRules.size
  $effectiveRules
    .filter(s => !isUsed(s)) // revise not yet used rules
    .filter(s => document.querySelector(s.selector))
    .each(s => markAsUsed(s.rule))
  console.log('added', $usedRules.size - was)
}


function gcRules () {
  console.log('GCing rules…')

  $allStyleRules.each(rule => {
    if (isUsed(rule))
      return
    var parent = rule.parentRule || rule.parentStyleSheet
    if (!parent) // already deleted
      return
    var index = Array.from(parent.cssRules).indexOf(rule)
    if (index == -1)
    {
      console.log('cant find rule in parent', rule, parent)
      return
    }
    parent.deleteRule(index)
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


var $domStates = []
function saveDOMState () {
  console.time('saveDOMState')
  $domStates.push(document.documentElement.cloneNode(true))
  console.timeEnd('saveDOMState')
}
function playBackStates (f) {
  function replaceDocumentElement (node) {
    var de = document.documentElement
    if (!de)
      return
    document.removeChild(de)
    document.appendChild(node)
  }
  function walk () {
    var state = $domStates.shift()
    if (!state)
      return // job is done
    replaceDocumentElement(state)
    f()
    // prevent the script from hanging the browser
    window.setTimeout(walk, 10)
  }
}


var $mutationObserver = new MutationObserver(function (mutations) { saveDOMState() })
function startWatchingMutations () {
  $mutationObserver.observe(document, { childList: true, attributes: true, subtree: true });
  console.log('started watching mutations')
}
function stopWatchingMutations () {
  $mutationObserver.disconnect()
  console.log('stopped watching mutations')
}

window.addEventListener('keypress', e => {
  if (!e.altKey)
    return

  if (e.code == 'KeyD')
    saveDOMState()  
  else if (e.code == 'KeyA')
    startWatchingMutations()
  else if (e.code == 'KeyS')
    playBack()
})

}()
