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
    console.time('Rules.catchMoreRules()')
    var was = this.usedRules.size
    this.effectiveRules()
      .filter(s => !this.isUsed(s)) // revise not yet used rules
      .filter(s => document.querySelector(s.selector))
      .each(s => this.markAsUsed(s.rule))
    console.timeEnd('Rules.catchMoreRules()')
    console.log('added', this.usedRules.size - was)
  }
  this.removeNotUsedRules = function () {
    console.time('Rules.removeNotUsedRules()')
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
        return done() // job is done
      replaceDocumentElement(state)
      f()
      // prevent the script from hanging the browser
      window.setTimeout(walk, 10)
    }
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

  function runRulesChecker () {
    var rules = new Rules()
    $states.playBack(
      function () { rules.catchMoreRules() },
      function () {
        rules.removeNotUsedRules()
        downloadPageCSS()
      }
    )
  }

  window.addEventListener('keypress', e => {
    if (!e.altKey)
      return

    if (e.code == 'KeyA') // add state
      $states.save()
    else if (e.code == 'KeyR') // record
      $mutations.toggleRecording()
    else if (e.code == 'KeyD') // download result
      runRulesChecker()
  })
}
bindUI()

}()
