// based on AuditRules.js from Chrome Dev Tools

!function () {

function Rules () {
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

  function getAllStyleRules () {
    return Array.from(document.styleSheets)
      .map(sheet => walkRules(sheet.cssRules))
      .flatten() // replace with reduce for production
      .filter(r => r.type == 1)
  }

  function getEffectiveRulesOf (rules) {
    return rules
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
        // cutting pseudos went well, use effective selector
        return {rule: rule, selector: effectiveSelector}
      })
      .filter(rule => rule) // remove nulls
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

  // caching part
  this.allStyleRules = function () {
    if (this._allStyleRules)
      return this._allStyleRules
    return this._allStyleRules = getAllStyleRules()
  }
  this.effectiveRules = function () {
    if (this._effectiveRules)
      return this._effectiveRules
    return this._effectiveRules = getEffectiveRulesOf(this.allStyleRules())
  }

  // stateful part

  this.usedRules = new Map()
  this.markAsUsed = function (rule) {
    this.usedRules.set(rule, true)
  }
  this.isUsed = function (rule) {
    return this.usedRules.get(rule)
  }
  this.catchMoreRules = function () {
    console.log('adding rules…')
    var was = this.usedRules.size
    this.effectiveRules()
      .filter(s => !this.isUsed(s)) // revise not yet used rules
      .filter(s => document.querySelector(s.selector))
      .each(s => this.markAsUsed(s.rule))
    console.log('added', this.usedRules.size - was)
  }
  this.gcRules = function () {
    console.log('GCing rules…')
    this.allStyleRules().each(rule => {
      if (this.isUsed(rule))
        return
      var parent = rule.parentRule || rule.parentStyleSheet
      if (!parent) // already deleted
        return
      var index = Array.from(parent.cssRules).indexOf(rule)
      if (index == -1)
      {
        console.warn('cant find rule in parent', rule, parent)
        return
      }
      parent.deleteRule(index)
    })
    console.log('GCed')
  }
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
