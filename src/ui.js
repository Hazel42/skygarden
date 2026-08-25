import { UPGRADES, ACHIEVEMENTS, FLOWER_UPGRADES, fmt } from './state.js'

const CAT_META = {
  buildings: ['🏯', 'Bangunan'],
  nature: ['🌳', 'Alam'],
  decor: ['🏮', 'Dekorasi'],
  lights: ['✨', 'Cahaya'],
  fauna: ['🦊', 'Fauna']
}

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
    this.btnManageMode = this.$('btnManageMode')
    this.btnBuildDone = this.$('btnBuildDone')
    this.buildHint = this.$('buildHint')
    this.slotsInfo = this.$('slotsInfo')
    this.objPanel = this.$('objPanel')
    this.objName = this.$('objName')
    this.objScaleVal = this.$('objScale')
    this.placePanel = this.$('placePanel')
    this.placeName = this.$('placeName')
    this.placeScaleVal = this.$('placeScale')
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
    this.authPanel = this.$('authPanel')
    this.authLogged = this.$('authLogged')
    this.authForm = this.$('authForm')
    this.authEmail = this.$('authEmail')
    this.inpName = this.$('inpName')
    this.inpEmail = this.$('inpEmail')
    this.inpPass = this.$('inpPass')
    this.authMsg = this.$('authMsg')
    this.accountIcon = this.$('accountIcon')
    this.accountLabel = this.$('accountLabel')

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
      if (on) {
        this.btnManageMode.classList.remove('on')
        this.btnManageMode.textContent = '🎛 Kelola: OFF'
      }
      this.btnDeleteMode.textContent = on ? '🗑 Hapus: ON' : '🗑 Hapus: OFF'
      hooks.onBuildMode(on ? 'remove' : 'place')
      this.updateBuildHint()
    })
    this.btnManageMode.addEventListener('click', () => {
      const on = this.btnManageMode.classList.toggle('on')
      if (on) {
        this.btnDeleteMode.classList.remove('on')
        this.btnDeleteMode.textContent = '🗑 Hapus: OFF'
      }
      this.btnManageMode.textContent = on ? '🎛 Kelola: ON' : '🎛 Kelola: OFF'
      hooks.onBuildMode(on ? 'manage' : 'place')
      this.updateBuildHint()
    })
    this.$('btnObjRotL').addEventListener('click', () => hooks.onObjRotate(-1))
    this.$('btnObjRotR').addEventListener('click', () => hooks.onObjRotate(1))
    this.$('btnObjScaleD').addEventListener('click', () => hooks.onObjScale(1 / 1.15))
    this.$('btnObjScaleU').addEventListener('click', () => hooks.onObjScale(1.15))
    this.$('btnObjStore').addEventListener('click', () => hooks.onObjStore())
    this.$('btnObjDelete').addEventListener('click', () => hooks.onObjDelete())
    this.$('btnObjFree').addEventListener('click', e => {
      const on = hooks.onObjFreeToggle()
      e.currentTarget.textContent = on ? '🕊 Bebas: ON' : '🕊 Bebas: OFF'
      e.currentTarget.classList.toggle('done', on)
    })
    this.$('btnObjUp').addEventListener('click', () => hooks.onObjUpgrade())
    this.$('btnObjSnap').addEventListener('click', e => {
      e.currentTarget.textContent = hooks.onObjSnapCycle()
    })
    this.$('btnVoxRemove').addEventListener('click', e => {
      hooks.onVoxSubMode('remove')
      e.currentTarget.classList.add('done')
      this.$('btnVoxAdd').classList.remove('done')
    })
    // material palette
    const MAT_COLORS = { grass: '#7FB069', stone: '#98A1AB', wood: '#8A5A3B', sand: '#E8D5A3', water: '#4FC3F7', glow: '#FFE2A8' }
    const pal = this.$('matPalette')
    if (pal) {
      for (const [id, color] of Object.entries(MAT_COLORS)) {
        const b = document.createElement('button')
        b.style.cssText = `width:28px;height:28px;border-radius:6px;cursor:pointer;background:${color};border:2px solid ${id === 'grass' ? '#fff' : 'transparent'}`
        b.title = id
        b.addEventListener('click', () => {
          pal.querySelectorAll('button').forEach(x => x.style.borderColor = 'transparent')
          b.style.borderColor = '#fff'
          hooks.onVoxMat(id)
        })
        pal.appendChild(b)
      }
    }
    this.$('btnGuideClose').addEventListener('click', () => hooks.onGuideDismiss())
    this.$('btnVoxMode').addEventListener('click', () => {
      const on = this.$('btnVoxMode').classList.toggle('on')
      this.$('btnVoxMode').textContent = on ? '🧱 Blok: ON' : '🧱 Blok: OFF'
      this.$('voxPanel').classList.toggle('hidden', !on)
      hooks.onVoxMode(on)
    })
    this.$('btnCloseVox').addEventListener('click', () => {
      this.$('voxPanel').classList.add('hidden')
      this.$('btnVoxMode').classList.remove('on')
      this.$('btnVoxMode').textContent = '🧱 Blok: OFF'
      hooks.onVoxMode(false)
    })
    this.$('btnVoxAdd').addEventListener('click', e => {
      hooks.onVoxSubMode('add')
      e.currentTarget.classList.add('done')
      this.$('btnVoxRemove').classList.remove('done')
    })
    this.$('btnVoxRemove').addEventListener('click', e => {
      hooks.onVoxSubMode('remove')
      e.currentTarget.classList.add('done')
      this.$('btnVoxAdd').classList.remove('done')
    })
    this.$('btnLbRefresh').addEventListener('click', () => hooks.onLeaderboardRefresh?.())
    this.$('btnObjClose').addEventListener('click', () => hooks.onObjClose())
    this.$('btnPRotL').addEventListener('click', () => hooks.onPlaceRotate(-1))
    this.$('btnPRotR').addEventListener('click', () => hooks.onPlaceRotate(1))
    this.$('btnPScaleD').addEventListener('click', () => this.setPlacePct(hooks.onPlaceScale(1 / 1.15)))
    this.$('btnPScaleU').addEventListener('click', () => this.setPlacePct(hooks.onPlaceScale(1.15)))
    this.$('btnPlaceCancel').addEventListener('click', () => hooks.onPlaceCancel())
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
    this.$('btnPhotoShot').addEventListener('click', () => hooks.onPhotoShot())
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
    this._risetArm = false
    this.$('btnRiset').addEventListener('click', e => {
      const b = e.currentTarget
      if (!this._risetArm) {
        this._risetArm = true
        b.textContent = 'Yakin? Semua bangunan & progres dihapus'
        setTimeout(() => { this._risetArm = false; b.textContent = '🔬 Riset Progres' }, 3200)
      } else {
    this._risetArm = false
    this._histFilter = 'all'
    const HIST_F = [['all', 'Semua'], ['🛍️', 'Beli'], ['🔨', 'Pasang'], ['🗺️', 'Pulau'], ['🏆', 'Feats']]
    const hf = this.$('histFilters')
    if (hf) {
      HIST_F.forEach(([ic, label]) => {
        const btn = document.createElement('button')
        btn.className = 'mini' + (ic === 'all' ? ' done' : '')
        btn.textContent = label
        btn.addEventListener('click', () => {
          this._histFilter = ic
          hf.querySelectorAll('button').forEach(b => b.classList.remove('done'))
          btn.classList.add('done')
          this._histSig = null
        })
        hf.appendChild(btn)
      })
    }
        b.textContent = '🔬 Riset Progres'
        hooks.onRiset()
      }
    })
    this.$('btnCloseUpgrades').addEventListener('click', () => this.toggleUpgrades())
    this.$('btnCloseBuild').addEventListener('click', () => this.closeBuild())
    this.$('btnCloseQuests').addEventListener('click', () => this.toggleQuests())
    this.$('btnCloseHelp').addEventListener('click', () => this.toggleHelp())
    this.$('btnExport').addEventListener('click', () => hooks.onExport())
    this.$('btnImport').addEventListener('click', () => hooks.onImport())
    this.$('btnAccount').addEventListener('click', () => this.toggleAuth())
    this.$('btnCloseAuth').addEventListener('click', () => this.toggleAuth(false))
    this.$('btnSignIn').addEventListener('click', () => hooks.onSignIn(this.inpEmail.value.trim(), this.inpPass.value))
    this.$('btnSignUp').addEventListener('click', () => hooks.onSignUp(this.inpEmail.value.trim(), this.inpPass.value))
    this.$('btnLogout').addEventListener('click', () => hooks.onSignOut())
    this.$('btnSaveName').addEventListener('click', () => hooks.onSaveName(this.inpName.value.trim()))

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
  get managing() { return this.btnManageMode.classList.contains('on') }

  showObj(info) {
    if (!info) return this.hideObj()
    this.objPanel.classList.remove('hidden')
    this.objName.textContent = info.name
    this.objScaleVal.textContent = info.pct + '%'
    const mv = this.$('btnObjMove')
    mv.classList.toggle('done', !!info.moving)
    mv.textContent = info.moving ? '🎯 Klik tanah…' : '🎯 Geser'
    const up = this.$('btnObjUp')
    if (up) {
      up.textContent = `⬆ Lv ${info.lv} → ${info.lv + 1} · ✨${fmt(info.upCost)}`
      up.disabled = this.state.essence < info.upCost
      up.title = 'Naikkan level: perk kategori +35% lebih besar'
    }
  }

  hideObj() {
    this.objPanel?.classList.add('hidden')
    this.$('objCoord').textContent = ''
  }

  showPlace(name, pct) {
    this.placeName.textContent = name || 'Menempatkan…'
    this.setPlacePct(pct ?? 100)
    this.placePanel.classList.remove('hidden')
  }

  setPlacePct(pct) {
    this.placeScaleVal.textContent = Math.round(pct) + '%'
  }

  hidePlace() {
    this.placePanel?.classList.add('hidden')
  }

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
    const hidden = this.buildPanel.classList.contains('hidden')
    if (!hidden && this._selectedBuild) {
      this.buildPanel.classList.add('hidden')
      this.dock?.detach(this.buildPanel)
      this.setBarActive(null)
      this.updateBuildHint()
      return
    }
    if (!hidden) {
      this.closeBuild()
      return
    }
    if (this._selectedBuild) {
      this.panel.classList.add('hidden')
      this.dock?.detach(this.panel)
      this.questsPanel.classList.add('hidden')
      this.dock?.detach(this.questsPanel)
      this.renderBuild()
      this._openPanel('build', this.buildPanel, this.btnBuild)
      return
    }
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
      buys: `Belanja ✧ ${q.target}× (aset/blessing/domain)`,
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

    // nearest achievements progress
    if (!this._achProgBox) this._achProgBox = document.createElement('div')
    this._achProgBox.style.marginTop = '10px'
    const unclaimed = ACHIEVEMENTS.filter(a => !s.ach[a.id])
    const nearest = unclaimed.slice(0, 3)
    let html = '<div class="dim" style="font-size:10px;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.5px">🎯 Berikutnya</div>'
    for (const a of nearest) {
      html += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px"><span style="opacity:.7">${a.icon}</span><span style="flex:1">${a.name}</span></div>`
    }
    if (!nearest.length) html += '<div class="dim" style="font-size:11px">Semua achievement selesai! 🎉</div>'
    this._achProgBox.innerHTML = html
    if (!this.achGrid.parentElement.contains(this._achProgBox)) {
      this.achGrid.parentElement.appendChild(this._achProgBox)
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
    const prevScroll = this.buildList.scrollTop
    this.buildList.innerHTML = ''
    this.buildCards = []

    const chips = []
    const sectD = document.createElement('div')
    sectD.className = 'sect'
    sectD.id = 'sec-dom'
    const bc = s.bonusCategory()
    const BC_META = { nature: '🌳 Alam', lights: '✨ Cahaya', buildings: '🏯 Bangunan', decor: '🏮 Dekorasi', fauna: '🦊 Fauna' }
    sectD.textContent = `🗺️ Domain & Luas Pulau · ∞ · ⚡ Hari ini: ${BC_META[bc] || bc} ×2`
    this.buildList.appendChild(sectD)
    chips.push(['sec-dom', '🗺️ Pulau'])

    for (const d of s.getDomainOffers()) {
      const lockedLv = s.gLevel < (d.minLv || 1)
      const card = document.createElement('div')
      card.className = 'card small' + (lockedLv ? ' locked' : '')
      card.addEventListener('mouseenter', () => this.hooks.onPreviewStop?.())
      card.innerHTML =
        `<div class="ci">${d.icon}</div>` +
        `<div class="cm"><div class="cn">${d.name}<span class="cl">Lv ${d.minLv}+</span></div>` +
        `<div class="cd">${lockedLv ? `🔒 garden Lv ${d.minLv}` : d.desc}</div></div>`
      const btn = document.createElement('button')
      btn.className = 'cb'
      btn.dataset.kind = 'dom'
      btn.dataset.id = d.id
      btn.textContent = '✨ ' + fmt(d.cost)
      btn.disabled = !s.canBuyDomain(d.id)
      btn.addEventListener('click', () => this.hooks.onDomainBuy(d.id))
      card.appendChild(btn)
      this.buildList.appendChild(card)
      this.buildCards.push(btn)
    }

    const cats = this.hooks.getStoreCategories?.() || []
    const items = this.hooks.getStoreItems?.() || []
    if (!items.length) {
      const empty = document.createElement('div')
      empty.className = 'sect dim'
      empty.textContent = 'Belum ada aset — taruh file .vox di public/models/store/<kategori>/ lalu jalankan `npm run store`.'
      this.buildList.appendChild(empty)
    }
    for (const cat of cats) {
      const group = items.filter(it => it.cat === cat.id)
      if (!group.length) continue
      const meta = CAT_META[cat.id] || ['📦', cat.name || cat.id]
      const sect = document.createElement('div')
      sect.className = 'sect'
      sect.id = 'sec-' + cat.id
      sect.textContent = `${meta[0]} ${meta[1]}`
      this.buildList.appendChild(sect)
      chips.push(['sec-' + cat.id, `${meta[0]} ${meta[1]}`])
      for (const it of group) {
        const copies = s.storeCopies(it.id)
        const placedN = s.placements.filter(p => p.t === it.id).length
        const free = copies - placedN
        const locked = s.gLevel < (it.minLv || 1)
        const card = document.createElement('div')
        card.className = 'card small' + (locked && !copies ? ' locked' : '') + (this._selectedBuild === it.id ? ' sel' : '')
        const scaleTxt = it.scale < 1 ? ` · ×${it.scale}` : ''
        let cd
        if (!copies) {
          cd = locked ? `🔒 garden Lv ${it.minLv}` : (it.zone === 'water' ? 'kolam · ' : '') + '✨ ' + fmt(it.price)
        } else if (free > 0) {
          cd = `${placedN}/${copies} terpasang · ＋ tempatkan${scaleTxt}`
        } else {
          cd = `✓ semua terpasang (${placedN}) — beli salinan lagi?`
        }
        const thumb = it.preview
          ? `<img src="${it.preview}" alt="" loading="lazy" draggable="false">`
          : '🧊'
        const inRecipe = (s._uniq || []).some(u => (u.a || []).includes(it.id) || (u.b || []).includes(it.id))
        const badge = inRecipe ? '<span style="position:absolute;top:2px;right:2px;font-size:9px">⚡</span>' : ''
        card.innerHTML =
          `<div class="ci" style="position:relative">${thumb}${badge}</div>` +
          `<div class="cm"><div class="cn">${it.name}</div><div class="cd">${cd}</div></div>`
        const btn = document.createElement('button')
        btn.className = 'cb'
        btn.dataset.kind = 'item'
        btn.dataset.id = it.id
        btn.dataset.price = String(Math.round(it.price))
        btn.dataset.minlv = String(it.minLv || 1)
        btn.dataset.act = !copies ? 'buy' : free > 0 ? 'sel' : 'more'
        btn.textContent =
          btn.dataset.act === 'buy' ? (locked && !copies ? '🔒' : '💰')
            : btn.dataset.act === 'sel' ? (this._selectedBuild === it.id ? '●' : '＋')
              : '＋1'
        btn.disabled = locked && !copies
        btn.addEventListener('click', () => {
          if (btn.dataset.act === 'sel') this.hooks.onBuildSelect(this._selectedBuild === it.id ? null : it.id)
          else this.hooks.onStoreBuy(it.id)
        })
        card.addEventListener('mouseenter', () => this.hooks.onPreviewItem?.(it.id))
        card.appendChild(btn)
        this.buildList.appendChild(card)
        this.buildCards.push(btn)
      }
    }
    this.slotsInfo.textContent = `Slot bangunan · ${s.placements.length} / ${s.slots()}`

    const chipBox = this.$('buildChips')
    if (chipBox) {
      chipBox.innerHTML = ''
      for (const [secId, label] of chips) {
        const c = document.createElement('button')
        c.textContent = label
        c.addEventListener('click', () => {
          this.buildList.querySelector('#' + secId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        chipBox.appendChild(c)
      }
    }
    this.buildList.scrollTop = prevScroll
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
    this.btnDeleteMode.textContent = '🗑 Hapus: OFF'
    this.btnManageMode.classList.remove('on')
    this.btnManageMode.textContent = '🎛 Kelola Objek: OFF'
    this.hideObj()
    this.hidePlace()
    this.$('voxPanel')?.classList.add('hidden')
    const vbn = this.$('btnVoxMode')
    if (vbn) { vbn.classList.remove('on'); vbn.textContent = '🧱 Blok: OFF' }
    this.hooks.onPreviewStop?.()
    if (!this.questsPanel.classList.contains('hidden')) this.setBarActive(this.btnQuests)
    else if (this.panel.classList.contains('hidden')) this.setBarActive(null)
  }

  setSelectedBuild(id) {
    this._selectedBuild = id
    this.buildPanel.classList.toggle('building', !!id)
    if (id) {
      if (!this.buildPanel.classList.contains('hidden')) {
        this.buildPanel.classList.add('hidden')
        this.dock?.detach(this.buildPanel)
        if (!this.panel.classList.contains('hidden')) this.setBarActive(this.btnUpgrades)
        else if (!this.questsPanel.classList.contains('hidden')) this.setBarActive(this.btnQuests)
        else this.setBarActive(null)
      }
      this.buildHint.textContent = 'klik untuk menempatkan · R rotasi · Esc selesai'
      this.buildHint.classList.remove('hidden')
    }
    this.renderBuild()
    this.updateBuildHint()
  }

  updateBuildHint() {
    const removing = this.btnDeleteMode.classList.contains('on')
    const managing = this.btnManageMode.classList.contains('on')
    if (removing) {
      this.buildHint.textContent = 'mode tata · klik objek untuk menghapus (refund 50%)'
      this.buildHint.classList.remove('hidden')
    } else if (managing) {
      this.buildHint.textContent = 'kelola · klik objek untuk memilih, lalu geser / putar / perbesar'
      this.buildHint.classList.remove('hidden')
    } else if (this._selectedBuild) {
      this.buildHint.textContent = 'klik untuk menempatkan · R rotasi · Esc selesai'
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
    const c = s.placedCounts()
    const pill = this.$('perkPill')
    if (pill) {
      const any = (c.nature + c.lights + c.buildings + c.decor + c.fauna) > 0
      pill.classList.toggle('hidden', !any)
      if (any) {
        pill.textContent =
          `🌿${Math.round(c.nature * 10) / 10} 💡${c.lights} 🏯${Math.round(c.buildings * 10) / 10} 🦊${c.fauna}`
      }
    }
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
      this.slotsInfo.textContent = `Slot bangunan · ${s.placements.length} / ${s.slots()}`
      for (const btn of this.buildCards || []) {
        if (btn.dataset.done === '1') continue
        if (btn.dataset.kind === 'dom') {
          btn.disabled = !s.canBuyDomain(btn.dataset.id)
        } else {
          const it = (this.hooks.getStoreItems?.() || []).find(x => x.id === btn.dataset.id)
          if (!it) continue
          const copies = s.storeCopies(it.id)
          const placedN = s.placements.filter(p => p.t === it.id).length
          const free = copies - placedN
          const locked = s.gLevel < (it.minLv || 1)
          const act = !copies ? 'buy' : free > 0 ? 'sel' : 'more'
          btn.dataset.act = act
          if (act === 'buy') {
            btn.disabled = locked || s.essence < it.price
            btn.textContent = locked ? '🔒' : '💰'
          } else if (act === 'sel') {
            btn.disabled = false
            btn.textContent = this._selectedBuild === it.id ? '●' : '＋'
          } else {
            btn.disabled = s.essence < it.price
            btn.textContent = '＋1'
          }
        }
      }
    }
    if (this._helpOpen) {
      const st = this.hooks.getStats?.() || {}
      if (!this._lbLoaded) { this._lbLoaded = true; this.hooks.onLeaderboardRefresh?.() }
      this.renderFlowerShop()
      this.renderDaily()
      this.statLines.innerHTML =
        `Garden Level 🌱 ${s.gLevel} (${Math.floor(s.xp)} / ${need} xp)<br>` +
        `Total gathered ✨ ${fmt(s.totalEarned)} · Taps 🌸 ${fmt(s.taps)}<br>` +
        `Garden flow 💧 +${fmt(s.passive)} / s<br>` +
        `Objek terpasang 🔨 ${st.placed ?? 0} / ${st.slots ?? '-'} slot · kategori terpakai 🎨 ${st.cats ?? 0}<br>` +
        `Aset dimiliki 🧊 ${st.owned ?? 0} · karya Forge 🎨 ${st.forge ?? 0}<br>` +
        `Pulau Tahap 🌾 ${st.stage ?? 1} · Domain 🗺️ ${st.domains ?? 0}/4<br>` +
        `<span style="color:#2f7d54">Perk taman: 🌳+${(st.pn * 2) || 0}/s · 💡+${((st.pl || 0) * 3)}% tap · 🏯+${((st.pb || 0) * 4)}% pasif · 🎨+${((st.pd || 0) * 2)}% XP · 🦊×${(1 + Math.min(st.pf || 0, 20) * 0.05).toFixed(2)} event · ragam +${((st.distinct || 0) * 3)}%</span><br>` +
        `<span style="color:#8a5acf">⚡ Sinergi: Lentera ${st.synL ?? 0} · Kuil ${st.synK ?? 0} · Desa ${st.synD ?? 0} · Satwa ${st.synS ?? 0} pasangan</span><br>` +
        `<span style="color:#c0569b">🌸 Bunga Abadi: ${s.flowers || 0} (+'${(((s.flowers || 0)) * 2).toFixed(0)}%' semua rate)</span><br>` +
        `<span style="color:#b7791f">🏅 Gelar: <b>${st.title ?? 'Taman Kecil'}</b> · skor ${st.gscore ?? 0} (+${((st.title ? ['Taman Kecil','Taman Menawan','Taman Istimewa','Taman Luar Biasa','Taman Legendaris','Taman Kayangan'].indexOf(st.title) : 0) * 3)}% semua rate)</span><br>` +
        (st.uniq ? `<span style="color:#b7791f">⭐ Resep unik: ${st.uniq}</span>` : '')
      const sig = state.history.map(h => h.ts).join(',') + '|' + (this._histFilter || 'all')
      if (this._histSig !== sig) {
        this._histSig = sig
        const box = this.$('histList')
        if (box) {
          const f = this._histFilter || 'all'
          const match = h => f === 'all' ||
            (f === 'build' && (h.ic === '🔨' || h.ic === '↩️' || h.ic === '📦')) ||
            h.ic === f
          box.innerHTML = state.history.filter(match).slice(0, 14).map(h => {
            const t = new Date(h.ts)
            const hh = String(t.getHours()).padStart(2, '0')
            const mm = String(t.getMinutes()).padStart(2, '0')
            return `<div class="h-row"><time>${hh}:${mm}</time><span>${h.ic || '•'} ${h.txt}</span></div>`
          }).join('')
          box.innerHTML = box.innerHTML || '<div class="dim">Belum ada aktivitas.</div>'
        }
      }
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

  toggleAuth(force) {
    const show = force !== undefined ? force : this.authPanel.classList.contains('hidden')
    for (const other of [this.panel, this.buildPanel, this.questsPanel, this.helpPanel]) {
      other.classList.add('hidden')
      this.dock?.detach(other)
    }
    this.authPanel.classList.toggle('hidden', !show)
    if (show) this.inpPass.value = ''
  }

  setAuthMsg(text, kind) {
    this.authMsg.textContent = text || ''
    this.authMsg.className = 'dim authmsg' + (kind ? ' ' + kind : '')
  }

  updateAuthUI({ isGuest, email, profile }) {
    if (isGuest) {
      this.authLogged.classList.add('hidden')
      this.authForm.classList.remove('hidden')
      this.setAuthMsg('')
      this.accountIcon.textContent = '👤'
      this.accountLabel.textContent = 'Guest'
    } else {
      this.authForm.classList.add('hidden')
      this.authLogged.classList.remove('hidden')
      this.authEmail.textContent = email || '(no email)'
      this.inpName.value = profile?.display_name || ''
      this.accountIcon.textContent = '🌱'
      this.accountLabel.textContent = profile?.display_name || profile?.username || 'Gardener'
    }
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

  showGuide() {
    this.$('guidePanel').classList.remove('hidden')
    this.updateGuide()
  }

  hideGuide() {
    this.$('guidePanel')?.classList.add('hidden')
  }

  updateGuide() {
    const s = this.state
    const steps = [
      ['e100', 'Kumpulkan 100 ✨ essence'],
      ['buy', 'Beli aset pertama di 🏪 Toko'],
      ['place', 'Tempatkan aset ke tanah (＋)'],
      ['manage', '👆 Tahan klik objek untuk mengatur']
    ]
    const box = this.$('guideList')
    if (!box) return
    box.innerHTML = steps.map(([k, label]) => {
      const done = !!s.guide[k]
      return `<div class="g-row${done ? ' done' : ''}"><span class="gx">${done ? '✓' : ''}</span><span>${label}</span></div>`
    }).join('')
  }

  setRank(rank) {
    const el = this.$('rankBadge')
    if (!el) return
    if (rank) {
      el.classList.remove('hidden')
      el.textContent = `🏅 #${rank}`
    } else {
      el.classList.add('hidden')
      el.textContent = '🏅'
    }
  }

  renderFlowerShop() {
    const s = this.state
    const box = this.$('flowerShop')
    if (!box) return
    const sig = JSON.stringify([s.flowers, s.flowerUp])
    if (this._fShopSig === sig) return
    this._fShopSig = sig
    box.innerHTML = ''
    for (const def of FLOWER_UPGRADES) {
      const lv = s.flowerUpLv(def.id)
      const maxed = lv >= def.max
      const row = document.createElement('div')
      row.className = 'card small quest'
      row.innerHTML =
        `<div class="cm"><div class="cn">${def.icon} ${def.name} <span class="cl">Lv ${lv}/${def.max}</span></div>` +
        `<div class="cd">${maxed ? 'MAKS' : def.desc}</div></div>`
      const btn = document.createElement('button')
      btn.className = 'cb'
      const cost = def.cost(lv + 1)
      btn.textContent = maxed ? 'MAX' : `🌸${cost}`
      btn.disabled = maxed || s.flowers < cost
      if (!maxed && s.flowers >= cost) btn.classList.add('claimable')
      btn.addEventListener('click', () => this.hooks.onBuyFlower?.(def.id))
      row.appendChild(btn)
      box.appendChild(row)
    }
  }

  renderDaily() {    const s = this.state
    s.ensureDaily()
    const box = this.$('dailyList')
    if (!box) return
    const sig = s.daily.date + '|' + s.daily.list.map(q => `${q.id}:${Math.floor(s.dailyProg(q))}:${q.claimed ? 1 : 0}`).join(',')
    if (this._dailySig === sig) return
    this._dailySig = sig
    box.innerHTML = ''
    for (const q of s.daily.list) {
      const prog = Math.min(q.target, s.dailyProg(q))
      const pct = Math.min(100, (prog / q.target) * 100)
      const row = document.createElement('div')
      row.className = 'card small quest'
      row.innerHTML =
        `<div class="cm"><div class="cn">${q.label} · 🌸${q.fl ? '+1 Bunga · ' : ''}✨${fmt(q.ess)}</div>` +
        `<div class="qbar"><div style="width:${pct}%"></div></div>` +
        `<div class="cd">${fmt(prog)} / ${fmt(q.target)}</div></div>`
      const btn = document.createElement('button')
      btn.className = 'cb'
      btn.textContent = q.claimed ? '✓' : q.done || prog >= q.target ? 'KLAIM' : `${Math.floor(pct)}%`
      btn.disabled = q.claimed || !(s.dailyDone(q))
      if (!q.claimed && s.dailyDone(q)) btn.classList.add('claimable')
      if (q.claimed) btn.classList.add('maxed')
      btn.addEventListener('click', () => this.hooks.onClaimDaily(q.id))
      row.appendChild(btn)
      box.appendChild(row)
    }
  }
  setBuildVisible(v) { this.btnBuild.classList.toggle('hidden', !v) }
}
