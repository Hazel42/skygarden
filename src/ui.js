import { UPGRADES, ACHIEVEMENTS, fmt } from './state.js'

export class UI {
  constructor(state, hooks) {
    this.state = state
    this.hooks = hooks
    this.$ = id => document.getElementById(id)
    this.essenceVal = this.$('essenceVal')
    this.rateVal = this.$('rateVal')
    this.tapVal = this.$('tapVal')
    this.comboBadge = this.$('comboBadge')
    this.lvlVal = this.$('lvlVal')
    this.xpFill = this.$('xpFill')
    this.panel = this.$('upgradePanel')
    this.buildPanel = this.$('buildPanel')
    this.buildList = this.$('buildList')
    this.btnUpgrades = this.$('btnUpgrades')
    this.btnBuild = this.$('btnBuild')
    this.btnDeleteMode = this.$('btnDeleteMode')
    this.btnBuildDone = this.$('btnBuildDone')
    this.buildHint = this.$('buildHint')
    this.slotsInfo = this.$('slotsInfo')
    this.btnSound = this.$('btnSound')
    this.btnTime = this.$('btnTime')
    this.btnHelp = this.$('btnHelp')
    this.btnFull = this.$('btnFull')
    this.soundIcon = this.btnSound.querySelector('.gi') || this.btnSound
    this.timeVal = this.$('timeVal') || this.btnTime
    this.fullIcon = this.$('fullVal') || this.btnFull
    this.helpPanel = this.$('helpPanel')
    this.rainBtn = this.$('rainBtn')
    this.btnQuests = this.$('btnQuests')
    this.questsPanel = this.$('questsPanel')
    this.questList = this.$('questList')
    this.btnPhoto = this.$('btnPhoto')
    this.buffPill = this.$('buffPill')
    this.starsVal = this.$('starsVal')
    this.starMult = this.$('starMult')
    this.ascFill = this.$('ascFill')
    this.ascHint = this.$('ascHint')
    this.btnAscend = this.$('btnAscend')
    this.hintEl = this.$('hint')
    this.toastEl = this.$('toast')
    this.floaters = this.$('floaters')
    this.statLines = this.$('statLines')
    this.intro = this.$('intro')
    this.banner = this.$('banner')

    this._toastT = null
    this._comboT = null
    this._bannerT = null
    this._resetArm = false
    this._helpOpen = false
    this._selectedBuild = null
    this.dock = null
    this.dockAnchors = null

    this.btnUpgrades.addEventListener('click', () => this.toggleUpgrades())
    this.btnBuild.addEventListener('click', () => this.toggleBuild())
    this.btnDeleteMode.addEventListener('click', () => {
      const on = this.btnDeleteMode.classList.toggle('on')
      hooks.onBuildMode(on ? 'remove' : 'place')
      this.updateBuildHint()
    })
    this.btnBuildDone.addEventListener('click', () => this.closeBuild())
    this.btnSound.addEventListener('click', () => hooks.onMute(!this.state.muted))
    this.btnTime.addEventListener('click', () => {
      this.timeVal.textContent = hooks.onTime()
    })
    this.btnHelp.addEventListener('click', () => {
      this._helpOpen = !this._helpOpen
      this.helpPanel.classList.toggle('hidden', !this._helpOpen)
    })
    this.rainBtn.addEventListener('click', () => hooks.onRain())
    this.btnQuests.addEventListener('click', () => this.toggleQuests())
    this.btnPhoto.addEventListener('click', () => this.togglePhoto())
    this.btnFull.addEventListener('click', () => hooks.onFullscreen())
    this._ascArm = false
    this.btnAscend.addEventListener('click', () => {
      if (!this.state.canAscend()) return
      if (!this._ascArm) {
        this._ascArm = true
        this.btnAscend.textContent = 'Ascend — sure?'
        setTimeout(() => { this._ascArm = false; this.syncAscendBtn() }, 3000)
      } else {
        this._ascArm = false
        hooks.onAscend()
      }
    })
    this.$('btnReset').addEventListener('click', e => {
      const b = e.currentTarget
      if (!this._resetArm) {
        this._resetArm = true
        b.textContent = 'Really reset?'
        setTimeout(() => { this._resetArm = false; b.textContent = '↺ Reset garden' }, 3000)
      } else hooks.onReset()
    })
    this.$('btnCloseUpgrades').addEventListener('click', () => this.toggleUpgrades())
    this.$('btnCloseBuild').addEventListener('click', () => this.closeBuild())
    this.$('btnCloseQuests').addEventListener('click', () => this.toggleQuests())
    this.$('btnCloseHelp').addEventListener('click', () => this.toggleHelp())
    this.$('btnExport').addEventListener('click', () => hooks.onExport())
    this.$('btnImport').addEventListener('click', () => hooks.onImport())

    this.intro.addEventListener('click', () => {
      if (this.intro.classList.contains('fade')) return
      this.intro.classList.add('fade')
      setTimeout(() => (this.intro.style.display = 'none'), 1000)
      hooks.onIntro()
    })

    this.syncSoundIcon()
    this.renderUpgrades()
    this.renderBuild()
  }

  syncSoundIcon() {
    this.soundIcon.textContent = this.state.muted ? '🔇' : '🔊'
  }

  get removing() { return this.btnDeleteMode.classList.contains('on') }

  attachDock(dock, anchors, camera) {
    this.dock = dock
    this.dockAnchors = anchors
    dock.camera = camera
  }

  _openPanel(key, el, btn) {
    for (const other of [this.panel, this.buildPanel, this.questsPanel]) {
      if (other !== el) {
        other.classList.add('hidden')
        this.dock?.detach(other)
      }
    }
    this.setBarActive(null)
    if (btn) btn.classList.add('active')
    el.classList.remove('hidden')
    this.dock?.attach(key, el)
  }

  setBarActive(btn) {
    for (const b of [this.btnUpgrades, this.btnBuild, this.btnQuests]) {
      b.classList.toggle('active', b === btn)
    }
  }

  closeAllPanels() {
    for (const el of [this.panel, this.buildPanel, this.questsPanel]) {
      el.classList.add('hidden')
      this.dock?.detach(el)
    }
    this.setBarActive(null)
  }

  toggleUpgrades() {
    if (!this.panel.classList.contains('hidden')) {
      this.panel.classList.add('hidden')
      this.dock?.detach(this.panel)
      this.setBarActive(null)
      return
    }
    this.closeBuild()
    this.questsPanel.classList.add('hidden')
    this.dock?.detach(this.questsPanel)
    this.renderUpgrades()
    this._openPanel('upgrades', this.panel, this.btnUpgrades)
  }

  toggleBuild() {
    if (!this.buildPanel.classList.contains('hidden') && !this._selectedBuild) {
      this.closeBuild()
      return
    }
    this.closeBuild()
    this.openBuild()
  }

  toggleQuests() {
    if (!this.questsPanel.classList.contains('hidden')) {
      this.questsPanel.classList.add('hidden')
      this.dock?.detach(this.questsPanel)
      this.setBarActive(null)
      return
    }
    this.closeBuild()
    this.renderQuests()
    this._openPanel('quests', this.questsPanel, this.btnQuests)
  }

  togglePhoto() {
    document.body.classList.toggle('photo-mode')
  }

  syncFullscreen(isFs) {
    this.fullIcon.textContent = isFs ? '🗗' : '⛶'
  }

  toggleHelp() {
    this._helpOpen = !this._helpOpen
    this.helpPanel.classList.toggle('hidden', !this._helpOpen)
  }

  anyPanelOpen() {
    return !this.panel.classList.contains('hidden') ||
      !this.buildPanel.classList.contains('hidden') ||
      !this.questsPanel.classList.contains('hidden') ||
      this._helpOpen
  }

  closeEverything() {
    this.panel.classList.add('hidden')
    this.dock?.detach(this.panel)
    this.closeBuild()
    this.questsPanel.classList.add('hidden')
    this.dock?.detach(this.questsPanel)
    if (this._helpOpen) this.toggleHelp()
    this.setBarActive(null)
  }

  questText(q) {
    const map = {
      collect: `Gather ✨ ${fmt(q.target)} essence`,
      taps: `Tap 🌸 ${q.target} times`,
      buys: `Purchase ✧ ${q.target} blessings`,
      placed: `Place 🔨 ${q.target} creations`,
      harvests: `Harvest 🍑 ${q.target} peaches`
    }
    return map[q.type] || q.type
  }

  renderQuests() {
    if (!this.questList) return
    this.questList.innerHTML = ''
    for (const q of this.state.quests) {
      const card = document.createElement('div')
      card.className = 'card small quest' + (q.done ? ' done' : '')
      const pct = Math.min(100, (q.prog / q.target) * 100).toFixed(0)
      card.innerHTML =
        `<div class="cm"><div class="cn">${this.questText(q)}</div>` +
        `<div class="qbar"><div style="width:${pct}%"></div></div>` +
        `<div class="cd">✨ ${fmt(q.reward.essence)} · +${fmt(q.reward.xp)} XP</div></div>`
      const btn = document.createElement('button')
      btn.className = 'cb'
      btn.textContent = q.claimed ? '…' : q.done ? 'CLAIM' : `${Math.floor(pct)}%`
      btn.disabled = !q.done || q.claimed
      if (q.done && !q.claimed) btn.classList.add('claimable')
      btn.addEventListener('click', () => this.hooks.onClaimQuest(q.id))
      card.appendChild(btn)
      this.questList.appendChild(card)
    }

    if (!this.achGrid) this.achGrid = this.$('achGrid')
    if (this.achGrid) {
      const s = this.state
      const done = ACHIEVEMENTS.filter(a => s.ach[a.id]).length
      this.$('achCount').textContent = `${done} / ${ACHIEVEMENTS.length}`
      this.achGrid.innerHTML = ''
      for (const a of ACHIEVEMENTS) {
        const got = !!s.ach[a.id]
        const chip = document.createElement('div')
        chip.className = 'ach' + (got ? ' done' : '')
        chip.title = a.desc + (got ? ' · ✓' : '')
        chip.innerHTML = `<span class="ai">${got ? a.icon : '🔒'}</span><span>${a.name}</span>`
        this.achGrid.appendChild(chip)
      }
    }
  }

  syncAscendBtn() {
    const s = this.state
    if (s.canAscend()) {
      this.btnAscend.disabled = false
      this.btnAscend.textContent = `✧ Ascend (+${s.potentialStars()}⭐)`
    } else {
      this.btnAscend.disabled = true
      this.btnAscend.textContent = s.gLevel >= 12 ? '✧ Ascend' : '🔒 Ascend at Lv 12'
    }
  }

  renderUpgrades() {
    const s = this.state
    this.panel.innerHTML = ''
    this.cards = []
    for (const u of UPGRADES) {
      const lvl = s.lvl(u.id)
      const maxed = lvl >= u.max
      const locked = s.gLevel < (u.minLv || 1)
      const card = document.createElement('div')
      card.className = 'card' + (locked ? ' locked' : '')
      card.innerHTML =
        `<div class="ci">${u.icon}</div>` +
        `<div class="cm"><div class="cn">${u.name}<span class="cl">Lv ${lvl}${u.max > 1 ? ' / ' + u.max : ''}</span></div>` +
        `<div class="cd">${locked ? `🔒 unlocks at garden Lv ${u.minLv}` : u.desc}</div></div>`
      const btn = document.createElement('button')
      btn.className = 'cb'
      btn.dataset.id = u.id
      btn.textContent = locked ? '🔒' : maxed ? 'MAX' : '✨ ' + fmt(s.cost(u.id))
      btn.disabled = locked || maxed || !s.canBuy(u.id)
      if (maxed && !locked) btn.classList.add('maxed')
      btn.addEventListener('click', () => this.hooks.onBuy(u.id))
      card.appendChild(btn)
      this.panel.appendChild(card)
      this.cards.push(btn)
    }
  }

  renderBuild() {
    const s = this.state
    this.buildList.innerHTML = ''
    this.buildCards = []
    for (const it of this.hooks.getCatalog()) {
      const locked = s.gLevel < it.minLv
      const card = document.createElement('div')
      card.className = 'card small' + (locked ? ' locked' : '') + (this._selectedBuild === it.id ? ' sel' : '')
      card.innerHTML =
        `<div class="ci">${it.icon}</div>` +
        `<div class="cm"><div class="cn">${it.name}</div>` +
        `<div class="cd">${locked ? `🔒 garden Lv ${it.minLv}` : (it.zone === 'water' ? 'pond only · ' : '') + '✨ ' + fmt(it.cost)}</div></div>`
      const btn = document.createElement('button')
      btn.className = 'cb'
      btn.textContent = locked ? '🔒' : (this._selectedBuild === it.id ? '●' : '＋')
      btn.disabled = locked
      btn.addEventListener('click', () => this.hooks.onBuildSelect(this._selectedBuild === it.id ? null : it.id))
      card.appendChild(btn)
      this.buildList.appendChild(card)
      this.buildCards.push(card)
    }
    this.slotsInfo.textContent = `Blueprint slots · ${s.placements.length} / ${s.slots()}`
  }

  openBuild() {
    this.panel.classList.add('hidden')
    this.dock?.detach(this.panel)
    this.questsPanel.classList.add('hidden')
    this.dock?.detach(this.questsPanel)
    this.renderBuild()
    this._openPanel('build', this.buildPanel, this.btnBuild)
  }

  closeBuild() {
    this.buildPanel.classList.add('hidden')
    if (this.dock && this.dock.current?.el === this.buildPanel) this.dock.detach(this.buildPanel)
    if (this._selectedBuild !== null) {
      this._selectedBuild = null
      this.hooks.onBuildSelect(null)
    }
    this.hooks.onBuildMode('place')
    this.btnDeleteMode.classList.remove('on')
    if (!this.questsPanel.classList.contains('hidden')) this.setBarActive(this.btnQuests)
    else if (this.panel.classList.contains('hidden')) this.setBarActive(null)
  }

  setSelectedBuild(id) {
    this._selectedBuild = id
    this.buildPanel.classList.toggle('building', !!id)
    if (id && this.buildPanel.classList.contains('hidden')) this.openBuild()
    this.renderBuild()
    this.updateBuildHint()
  }

  updateBuildHint() {
    const removing = this.btnDeleteMode.classList.contains('on')
    if (removing) {
      this.buildHint.textContent = 'click a creation to remove it (50% refund)'
      this.buildHint.classList.remove('hidden')
    } else if (this._selectedBuild) {
      this.buildHint.textContent = 'click to place · R rotate · Esc done'
      this.buildHint.classList.remove('hidden')
    } else {
      this.buildHint.classList.add('hidden')
    }
  }

  refresh() {
    const s = this.state
    this.essenceVal.textContent = fmt(s.essence)
    this.rateVal.textContent = `+${fmt(s.passive)}/s`
    this.tapVal.textContent = `tap +${fmt(s.tapValue)}`
    this.lvlVal.textContent = 'Lv ' + s.gLevel
    const need = s.xpNeed(s.gLevel + 1)
    this.xpFill.style.width = Math.min(100, (s.xp / need) * 100).toFixed(1) + '%'
    if (s.buffActive()) {
      this.buffPill.classList.remove('hidden')
      this.buffPill.textContent = `🔥 ×2 · ${Math.ceil(s.buffRemaining() / 1000)}s`
    } else {
      this.buffPill.classList.add('hidden')
    }
    this.starsVal.textContent = '⭐ ' + s.stars
    this.starMult.textContent = (1 + s.stars * 0.35).toFixed(2)
    this.ascFill.style.width = Math.min(100, (s.runEarned / s.nextStarAt()) * 100).toFixed(1) + '%'
    this.ascHint.textContent = s.gLevel >= 12
      ? `${fmt(s.runEarned)} / ${fmt(s.nextStarAt())} earned this life`
      : `Reach garden Lv 12 · now Lv ${s.gLevel}`
    this.syncAscendBtn()
    if (this.cards) {
      for (const btn of this.cards) {
        const id = btn.dataset.id
        const u = UPGRADES.find(x => x.id === id)
        const maxed = s.lvl(id) >= u.max
        const locked = s.gLevel < (u.minLv || 1)
        if (!locked && !maxed) btn.textContent = '✨ ' + fmt(s.cost(id))
        btn.disabled = locked || maxed || !s.canBuy(id)
      }
    }
    if (!this.buildPanel.classList.contains('hidden')) {
      this.slotsInfo.textContent = `Blueprint slots · ${s.placements.length} / ${s.slots()}`
    }
    if (this._helpOpen) {
      this.statLines.innerHTML =
        `Garden Level 🌱 ${s.gLevel} (${Math.floor(s.xp)} / ${need} xp)<br>` +
        `Total gathered ✨ ${fmt(s.totalEarned)} · Taps 🌸 ${fmt(s.taps)}<br>` +
        `Garden flow 💧 +${fmt(s.passive)} / s`
    }
  }

  showCombo(mult) {
    if (mult <= 1.06) {
      this.comboBadge.classList.add('hidden')
      return
    }
    this.comboBadge.textContent = '×' + mult.toFixed(1)
    this.comboBadge.classList.remove('hidden')
    clearTimeout(this._comboT)
    this._comboT = setTimeout(() => this.comboBadge.classList.add('hidden'), 1400)
  }

  floater(x, y, text, cls = 'pink') {
    const d = document.createElement('div')
    d.className = 'floater ' + cls
    d.textContent = text
    d.style.left = x + 'px'
    d.style.top = y - 14 + 'px'
    this.floaters.appendChild(d)
    setTimeout(() => d.remove(), 1050)
  }

  toast(msg, dur = 2800) {
    this.toastEl.textContent = msg
    this.toastEl.style.opacity = 1
    clearTimeout(this._toastT)
    this._toastT = setTimeout(() => (this.toastEl.style.opacity = 0), dur)
  }

  flashSaved() {
    if (!this._saveEl) this._saveEl = this.$('saveFlash')
    if (!this._saveEl) return
    this._saveEl.classList.add('show')
    clearTimeout(this._saveT)
    this._saveT = setTimeout(() => this._saveEl.classList.remove('show'), 900)
  }

  setCloudState(s) {
    const el = this.$('cloudState')
    if (!el) return
    el.classList.remove('hidden')
    if (s === 'sync') { el.textContent = '☁️…'; el.className = 'cloudsync' }
    else if (s === 'on') { el.textContent = '☁️ ✓'; el.className = 'cloudon' }
    else if (s === 'err') { el.textContent = '☁️ ⚠'; el.className = 'clouderr' }
    else { el.classList.add('hidden'); el.className = 'hidden' }
  }

  showBanner(title, sub) {
    this.banner.innerHTML = `<div class="bt">${title}</div><div class="bs">${sub}</div>`
    this.banner.classList.remove('show')
    void this.banner.offsetWidth
    this.banner.classList.add('show')
    clearTimeout(this._bannerT)
    this._bannerT = setTimeout(() => this.banner.classList.remove('show'), 3600)
  }

  pulseCounter() {
    const el = this.$('counter')
    el.classList.remove('pulse')
    void el.offsetWidth
    el.classList.add('pulse')
  }

  showHint() { this.hintEl.classList.remove('hidden') }
  hideHint() { this.hintEl.classList.add('hidden') }

  setRainVisible(v) { this.rainBtn.classList.toggle('hidden', !v) }
  setRainOn(on) { this.rainBtn.classList.toggle('on', on) }
  setBuildVisible(v) { this.btnBuild.classList.toggle('hidden', !v) }
}
