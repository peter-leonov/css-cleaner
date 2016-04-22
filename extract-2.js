// based on AuditRules.js from Chrome Dev Tools

!function () {

function Rules () {
  // stateful part
  var usedRules = new Map()
  function markAsUsed (rule) {
    usedRules.set(rule, true)
  }
  function isUsed (rule) {
    return usedRules.get(rule)
  }

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

  this.catchMoreRules = function (documentElement) {
    console.time('Rules.catchMoreRules()')
    var was = usedRules.size
    this.effectiveRules()
      .filter(s => !isUsed(s)) // revise not yet used rules
      .filter(s => documentElement.querySelector(s.selector))
      .each(s => markAsUsed(s.rule))
    console.timeEnd('Rules.catchMoreRules()')
    console.log('added', usedRules.size - was)
  }
  this.saveUsedRules = function () {
    var persistent = JSON.parse(window.localStorage.getItem('css-gc') || '{}')
    this.allStyleRules().filter(rule => isUsed(rule)).each(rule => {
      persistent[rule.selectorText] = true
    })
    window.localStorage.setItem('css-gc', JSON.stringify(persistent))
  }
  this.removeNotUsedRules = function () {
    console.time('Rules.removeNotUsedRules()')
    var persistent = JSON.parse(window.localStorage.getItem('css-gc') || '{}')
    this.allStyleRules().each(rule => {
      if (persistent[rule.selectorText])
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
    console.timeEnd('Rules.removeNotUsedRules()')
  }
}

function States () {
  var states = []

  this.save = function () {
    console.time('states.save()')
    states.push(document.documentElement.cloneNode(true))
    console.timeEnd('states.save()')
  }
  this.playBack = function (f, done) {
    function walk () {
      var state = states.shift()
      if (!state)
        return done() // job is done
      f(state)
      // prevent the script from hanging the browser
      window.setTimeout(walk, 10)
    }
    walk()
  }
}

function Mutations (f) {
  var observer = new MutationObserver(f)
  this.recording = false
  this.toggleRecording = function () {
    if (this.recording) {
      this.stopRecording()
      this.recording = false
    } else {
      this.startRecording()
      this.recording = true
    }
  }
  this.startRecording = function () {
    if (this.recording)
      return
    observer.observe(document, { childList: true, attributes: true, subtree: true });
    console.log('started watching mutations')
  }
  this.stopRecording = function () {
    if (!this.recording)
      return
    observer.disconnect()
    console.log('stopped watching mutations')
  }
}

function downloadPageCSS () {
  function stringifyPageRules () {
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

  function downloadURI(uri, name) {
    var link = document.createElement("a");
    link.download = name;
    link.href = uri;
    link.click();
  }

  var css = stringifyPageRules()
  downloadURI('data:text/css,' + escape(css), 'style.css')
}


function bindUI () {

  var $mutations = new Mutations(function () { $states.save() })
  var $states = new States()
  var $rules = new Rules()

  function calculateAndSaveUsedRules () {
    $states.playBack(
      function (documentElement) { $rules.catchMoreRules(documentElement) },
      function () {
        $rules.saveUsedRules()
        console.log('saved!')
      }
    )
  }

  function downloadUsedRules () {
    $rules.removeNotUsedRules()
    downloadPageCSS()
  }

  window.addEventListener('keypress', e => {
    if (!e.altKey)
      return

    if (e.code == 'KeyA') // add state
      $states.save()
    else if (e.code == 'KeyR') // record
      $mutations.toggleRecording()
    else if (e.code == 'KeyS') // download result
      calculateAndSaveUsedRules()
    else if (e.code == 'KeyD') // download result
      downloadUsedRules()
  })
}
bindUI()

}()
