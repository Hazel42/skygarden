export const UPGRADES = [
  { id: 'lotus', icon: '🪷', name: 'Sacred Lotus', desc: '+0.5 essence/s each', base: 25, growth: 1.5, max: 50, minLv: 1 },
  { id: 'chimes', icon: '🎐', name: 'Wind Chimes', desc: '+0.25 per tap each', base: 15, growth: 1.45, max: 100, minLv: 1 },
  { id: 'lanterns', icon: '🏮', name: 'Sky Lanterns', desc: '+2/s each · more lanterns drift above', base: 200, growth: 1.55, max: 40, minLv: 1 },
  { id: 'butterflies', icon: '🦋', name: 'Glow Butterflies', desc: '+3/s and +0.35 tap each', base: 400, growth: 1.5, max: 30, minLv: 1 },
  { id: 'koi', icon: '🐟', name: 'Koi Companions', desc: '+6/s each · they swim the pond', base: 750, growth: 1.6, max: 20, minLv: 1 },
  { id: 'fox', icon: '🦊', name: 'Sleepy Fox Spirit', desc: '×1.25 everything · naps on a stone', base: 5000, growth: 3.2, max: 4, minLv: 2 },
  { id: 'sakura', icon: '🌸', name: 'Sakura Breeze', desc: '×1.2 taps · petals fill the air', base: 30000, growth: 1, max: 1, minLv: 3 },
  { id: 'rain', icon: '🌧️', name: 'Monsoon Blessing', desc: 'unlocks gentle rain · ×1.5 while raining', base: 60000, growth: 1, max: 1, minLv: 4 },
  { id: 'incense', icon: '🔥', name: 'Bronze Incense Burner', desc: 'tap the burner by the pagoda · ×2 essence for 60s', base: 15000, growth: 3, max: 3, minLv: 3 },
  { id: 'cloudsea', icon: '☁️', name: 'Cloud Sea', desc: '×1.3 everything · thickens the cloud sea below', base: 80000, growth: 1, max: 1, minLv: 4 },
  { id: 'spirits', icon: '✨', name: 'Forest Spirits', desc: '+30/s each · wisps wander the garden', base: 120000, growth: 1.7, max: 20, minLv: 4 },
  { id: 'cranes', icon: '🕊️', name: 'Immortal Cranes', desc: '+120/s each · glide between the isles', base: 250000, growth: 2.6, max: 2, minLv: 5 },
  { id: 'goldenkoi', icon: '🐠', name: 'Golden Koi Blessing', desc: 'the koi shimmer gold · ×1.4 everything', base: 500000, growth: 1, max: 1, minLv: 5 },
  { id: 'phoenix', icon: '🔥', name: 'Legendary Phoenix', desc: '×2 everything · circles the pagoda', base: 2000000, growth: 5, max: 3, minLv: 7 },
  { id: 'rabbit', icon: '🐇', name: 'Moon Rabbit', desc: '+2500/s · pounds the elixir of immortality', base: 6000000, growth: 1, max: 1, minLv: 8 },
  { id: 'dragon', icon: '🐉', name: 'Azure Celestial Dragon', desc: '×3 everything · dances through the heavens', base: 25000000, growth: 6, max: 1, minLv: 10 }
]

export const ISLES = [  { key: 'dawn', icon: '⛩️', name: 'Pulau Torii', baseR: 7, rate: 40, cost: 15000, minLv: 3, expBase: 150000 },
  { key: 'lotus', icon: '🪷', name: 'Lotus Haven', baseR: 6, rate: 150, cost: 120000, minLv: 4, expBase: 400000 },
  { key: 'jade', icon: '🏯', name: 'Jade Terrace', baseR: 8, rate: 600, cost: 900000, minLv: 6, expBase: 2500000 },
  { key: 'star', icon: '🌟', name: 'Star Peak', baseR: 3, rate: 450, cost: 900000, minLv: 6, expBase: 2500000 }
]

const MAIN_COST_LEGACY = { 2: 2500, 3: 40000, 4: 300000 }
const MAIN_R_LEGACY = { 1: 8, 2: 10.5, 3: 13, 4: 15 }

export function mainIslandRadius(stage) {
  return stage <= 4 ? MAIN_R_LEGACY[stage] : 15 + (stage - 4) * 2.5
}

export function mainStageCost(stage) {
  if (stage <= 4) return MAIN_COST_LEGACY[stage]
  return Math.round(300000 * Math.pow(7, stage - 4))
}

export function mainStageMinLv(stage) {
  return stage <= 4 ? 2 + (stage - 2) * 2 : 6 + (stage - 4) * 2
}

function isleExpCost(isle, nextExp) {
  return Math.round(isle.expBase * Math.pow(10, nextExp - 1))
}

function isleExpMinLv(isle, nextExp) {
  return isle.minLv + nextExp * 2
}

export const LEVEL_UNLOCKS = {
  2: '🏪 Toko & Perluasan Pulau terbuka',
  3: '⛩️ Domain Pulau Torii tersedia',
  4: '🌧️ Monsoon & Cloud Sea',
  5: '🕊️ Immortal Cranes & Golden Koi',
  6: '🏯 Domain Jade Terrace & Star Peak',
  7: '🔥 Legendary Phoenix',
  8: '🐇 Moon Rabbit',
  9: '✨ Greater spirits',
  10: '🐉 AZURE CELESTIAL DRAGON'
}

export const ACHIEVEMENTS = [
  { id: 'tap1', icon: '🌸', name: 'First Touch', desc: 'Tap the garden', check: s => s.taps >= 1 },
  { id: 'tap100', icon: '🤲', name: 'Gentle Hands', desc: 'Tap 100 times', check: s => s.taps >= 100 },
  { id: 'tap1k', icon: '🧑‍🌾', name: 'Gardener Soul', desc: 'Tap 1,000 times', check: s => s.taps >= 1000 },
  { id: 'earn10k', icon: '✨', name: 'Spirit Gatherer', desc: 'Collect 10K essence', check: s => s.allTime >= 1e4 },
  { id: 'earn10m', icon: '💎', name: 'Essence Baron', desc: 'Collect 10M essence', check: s => s.allTime >= 1e7 },
  { id: 'earn1b', icon: '🏛️', name: 'Celestial Treasury', desc: 'Collect 1B essence', check: s => s.allTime >= 1e9 },
  { id: 'build5', icon: '🔨', name: 'Landscaper', desc: 'Place 5 creations', check: s => s.placements.length >= 5 },
  { id: 'build15', icon: '🏗️', name: 'Master Gardener', desc: 'Place 15 creations', check: s => s.placements.length >= 15 },
  { id: 'lv10', icon: '🌱', name: 'Rising Star', desc: 'Reach garden Lv 10', check: s => s.gLevel >= 10 },
  { id: 'asc1', icon: '✧', name: 'First Ascension', desc: 'Ascend once', check: s => s.ascensions >= 1 },
  { id: 'star5', icon: '⭐', name: 'Starry Soul', desc: 'Own 5 Immortal Stars', check: s => s.stars >= 5 },
  { id: 'phoenix', icon: '🔥', name: 'Firebird Friend', desc: 'Awaken the Phoenix', check: s => (s.levels.phoenix || 0) >= 1 },
  { id: 'dragon', icon: '🐉', name: 'Dragon Rider', desc: 'Awaken the Azure Dragon', check: s => (s.levels.dragon || 0) >= 1 },
  { id: 'isles', icon: '🗺️', name: 'Archipelago', desc: 'Own all 4 island domains', check: s => s.domains.dawn && s.domains.jade && s.domains.lotus && s.domains.star },
  { id: 'kolektor', icon: '🧺', name: 'Kolektor', desc: 'Miliki 10 aset toko berbeda', check: s => Object.keys(s.storeOwned).length >= 10 },
  { id: 'arsitek25', icon: '🏗️', name: 'Arsitek Langit', desc: 'Tempatkan 25 bangunan & objek', check: s => s.placements.length >= 25 },
  { id: 'dekorator', icon: '🎨', name: 'Sang Dekorator', desc: 'Tempatkan aset dari 3 kategori berbeda', check: s => new Set(s.placements.map(p => String(p.t || '').split('/')[0]).filter(Boolean)).size >= 3 }
]

export const FLOWER_UPGRADES = [
  { id: 'tap', icon: '👆', name: 'Tangan Subur', desc: '+15% nilai tap per level', max: 10, cost: lv => 2 + (lv - 1) * 2 },
  { id: 'pasif', icon: '💧', name: 'Roh Taman', desc: '+4% pendapatan pasif per level', max: 10, cost: lv => 3 + (lv - 1) * 2 },
  { id: 'event', icon: '🌸', name: 'Pekan Mekar', desc: 'Bloom +5 dtk, Meteor +25% per level', max: 6, cost: lv => 4 + (lv - 1) * 3 },
  { id: 'time', icon: '⏰', name: 'Taman Waktu', desc: 'Offline maksimum +4 jam per level', max: 4, cost: lv => 5 + (lv - 1) * 5 }
]

const U_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]))
const SAVE_KEY = 'sakura-sky-garden-v1'

const freshDomains = () => ({ main: 1, dawn: false, jade: false, lotus: false, star: false, dawnX: 0, jadeX: 0, lotusX: 0, starX: 0 })

export function fmt(n) {
  if (!isFinite(n)) return '∞'
  if (n < 1000) return n < 10 ? String(Math.round(n * 10) / 10).replace(/\.0$/, '') : String(Math.floor(n))
  const u = ['K', 'M', 'B', 'T', 'Qa']
  let i = -1
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++ }
  return (n < 100 ? n.toFixed(1) : Math.floor(n).toString()) + u[i]
}

export class GameState {
  constructor() {
    this.listeners = new Map()
    this.essence = 0
    this.totalEarned = 0
    this.taps = 0
    this.levels = {}
    this.domains = freshDomains()
    this.pgTier = 1
    this.storeOwned = {}
    this.forgeAssets = []
    this.tips = {}
    this.slotBonus = 0
    this.history = []
    this.guide = {}
    this.discSyn = []
    this.flowerUp = {}
    this.loginStreak = 0
    this.lastLoginDate = ''
    this.muted = false
    this.rainOn = false
    this.xp = 0
    this.gLevel = 1
    this.placements = []
    this.stars = 0
    this.flowers = 0
    this.ascensions = 0
    this.allTime = 0
    this.runEarned = 0
    this.buffUntil = 0
    this.counters = { collected: 0, taps: 0, placed: 0, buys: 0, harvests: 0 }
    this.quests = []
    this.ach = {}
    this.tapValue = 1
    this.passive = 0
    this.recalc()
  }

  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set())
    this.listeners.get(evt).add(fn)
    return () => this.off(evt, fn)
  }

  off(evt, fn) { this.listeners.get(evt)?.delete(fn) }
  emit(evt, payload) { this.listeners.get(evt)?.forEach(fn => fn(payload)) }

  lvl(id) { return this.levels[id] || 0 }

  cost(id) {
    const u = U_BY_ID[id]
    return Math.ceil(u.base * Math.pow(u.growth, this.lvl(id)))
  }

  xpNeed(l) { return Math.round(90 * Math.pow(1.5, l - 1)) }

  slots() { return 6 + this.gLevel * 2 + this.ascensions * 3 + this.slotBonus * 5 }

  slotCost(n) { return Math.round(1200 * Math.pow(4.5, n - 1)) }

  buffActive() { return Date.now() < this.buffUntil }

  logEvent(txt, icon = '•') {
    if (!txt) return
    this.history.unshift({ txt: String(txt).slice(0, 90), ts: Date.now(), ic: icon })
    if (this.history.length > 60) this.history.length = 60
  }
  buffRemaining() { return Math.max(0, this.buffUntil - Date.now()) }
  activateBuff(ms) { this.buffUntil = Math.max(this.buffUntil, Date.now() + ms) }

  potentialStars() { return Math.floor(Math.pow(Math.max(0, this.runEarned) / 2e6, 0.55)) }
  canAscend() { return this.gLevel >= 12 && this.potentialStars() >= 1 }
  nextStarAt() { return Math.pow(this.potentialStars() + 1, 1 / 0.55) * 2e6 }

  ascend() {
    if (!this.canAscend()) return null
    const gain = this.potentialStars()
    this.stars += gain
    this.ascensions++
    this.essence = 200 * gain
    this.levels = {}
    this.totalEarned = 0
    this.runEarned = 0
    this.xp = 0
    this.gLevel = 1
    this.rainOn = false
    this.recalc()
    this.emit('ascend', { gain })
    return gain
  }

  risetProgress() {
    const wasLevel = this.gLevel
    const fresh =
      this.gLevel <= 1 && (!Number.isFinite(this.xp) || this.xp <= 0) &&
      Object.keys(this.levels).length === 0 &&
      this.placements.length === 0 &&
      Object.keys(this.storeOwned).length === 0 &&
      (this.domains.main || 1) <= 1 && !this.domains.dawn && !this.domains.jade &&
      !this.domains.lotus && !this.domains.star
    if (fresh) return null
    this.gLevel = 1
    this.xp = 0
    this.levels = {}
    this.placements.length = 0
    this.storeOwned = {}
    this.domains = freshDomains()
    this.pgTier = 1
    this.forgeAssets = []
    this.flowers = (this.flowers || 0) + 1
    this.rainOn = false
    this.buffUntil = 0
    this.recalc()
    this.emit('riset', { from: wasLevel })
    return { from: wasLevel }
  }

  _makeQuest() {
    const L = this.gLevel
    const r = Math.random()
    let q
    if (r < 0.32) {
      q = { type: 'collect', target: Math.round(400 * Math.pow(2.5, Math.min(L, 14)) * (0.8 + Math.random() * 0.4)), label: 'Garden essence' }
    } else if (r < 0.54) {
      q = { type: 'taps', target: Math.round((50 + L * 35) * (0.8 + Math.random() * 0.4)), label: 'Tend the garden' }
    } else if (r < 0.72) {
      q = { type: 'buys', target: 2 + Math.floor(Math.random() * 3), label: 'New blessings' }
    } else if (r < 0.87) {
      q = { type: 'placed', target: 2 + Math.floor(Math.random() * 4), label: 'Shape the garden' }
    } else {
      q = { type: 'harvests', target: 2 + Math.floor(Math.random() * 3), label: 'Peaches of immortality' }
    }
    q.id = Date.now() + '_' + Math.floor(Math.random() * 1e6)
    q.prog = 0
    q.done = false
    q.claimed = false
    q.reward = {
      essence: Math.round(300 * Math.pow(2.4, Math.min(L, 14)) * (0.9 + Math.random() * 0.3)),
      xp: Math.round(this.xpNeed(L + 1) * 0.3)
    }
    return q
  }

  ensureQuests() {
    this.quests = this.quests.filter(q => !q.claimed)
    while (this.quests.length < 3) this.quests.push(this._makeQuest())
  }

  questEvent(type, n = 1) {
    if (this.counters[type] !== undefined) this.counters[type] += n
    let completed = false
    for (const q of this.quests) {
      if (q.type !== type || q.done) continue
      q.prog = Math.min(q.target, q.prog + n)
      if (q.prog >= q.target) { q.done = true; completed = true }
    }
    if (completed) this.emit('questdone')
  }

  claimQuest(id) {
    const idx = this.quests.findIndex(q => q.id === id)
    if (idx < 0) return null
    const q = this.quests[idx]
    if (!q.done || q.claimed) return null
    q.claimed = true
    this.essence += q.reward.essence
    this.totalEarned += q.reward.essence
    this.runEarned += q.reward.essence
    this.allTime += q.reward.essence
    this.addXp(q.reward.xp)
    this.quests.splice(idx, 1)
    this.ensureQuests()
    this.emit('questclaim')
    return q.reward
  }

  hashStr(s) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
    return h >>> 0
  }

  ensureDaily(key) {
    key = key || this._dailyKey()
    if (this.daily && this.daily.date === key && Array.isArray(this.daily.list)) return
    const h = this.hashStr(key)
    const defs = [
      { type: 'collect', label: 'Kumpulkan essence' },
      { type: 'taps', label: 'Tap taman', min: 25, span: 35 },
      { type: 'buys', label: 'Belanja di toko/blessing', fixed: [1, 2] },
      { type: 'placed', label: 'Tempatkan objek', fixed: [1, 3] }
    ]
    const i1 = h % defs.length
    let i2 = (h >>> 3) % defs.length
    if (i2 === i1) i2 = (i2 + 1) % defs.length
    const mk = (def, ix, fl) => {
      const base = this.counters[def.type] || 0
      let target
      if (def.type === 'collect') target = Math.max(400, Math.round((this.passive || 1) * 45))
      else if (def.fixed) target = def.fixed[0] + ((h >>> ix) % (def.fixed[1] - def.fixed[0] + 1))
      else target = def.min + ((h >>> ix) % def.span)
      return {
        id: 'd' + ix,
        type: def.type,
        label: def.label,
        base,
        target,
        prog: 0,
        done: false,
        claimed: false,
        ess: Math.round(Math.max(500, (this.passive || 1) * 80)),
        xp: Math.round(this.xpNeed(this.gLevel) * 0.5),
        fl: fl ? 1 : 0
      }
    }
    this.daily = {
      date: key,
      list: [mk(defs[i1], 0, true), mk(defs[i2], 1, false)]
    }
  }

  _dailyKey() {
    const d = new Date()
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }

  dailyProg(q) { return Math.max(0, (this.counters[q.type] || 0) - q.base) }
  dailyDone(q) { return this.dailyProg(q) >= q.target }

  flowerUpLv(id) { return Math.floor(this.flowerUp[id] || 0) }

  buyFlowerUpgrade(id) {
    const def = FLOWER_UPGRADES.find(f => f.id === id)
    if (!def) return null
    const cur = this.flowerUpLv(id)
    if (cur >= def.max) return null
    const cost = def.cost(cur + 1)
    if (this.flowers < cost) return null
    this.flowers -= cost
    this.flowerUp[id] = cur + 1
    this.recalc()
    this.logEvent(`🌸 ${def.name} Lv${cur + 1}`, '🌸')
    this.emit('flowershop', { id, lv: cur + 1 })
    return { ok: true, lv: cur + 1, name: def.name }
  }

  claimDaily(id) {
    if (!this.daily) return null
    const q = this.daily.list.find(x => x.id === id)
    if (!q || q.claimed || !this.dailyDone(q)) return null
    q.claimed = true
    const reward = { ess: q.ess, xp: q.xp, fl: q.fl || 0 }
    if (reward.fl) this.flowers += reward.fl
    this.essence += reward.ess
    this.totalEarned += reward.ess
    this.allTime += reward.ess
    this.runEarned += reward.ess
    this.addXp(reward.xp)
    this.logEvent(`📅 Tantangan harian: ${q.label}`, '📅')
    this.emit('dailyclaim', reward)
    return reward
  }

  checkAchievements() {
    this.ensureDaily()
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const a = ACHIEVEMENTS[i]
      if (this.ach[a.id]) continue
      let ok = false
      try { ok = a.check(this) } catch (e) { }
      if (!ok) continue
      this.ach[a.id] = true
      const reward = Math.round(300 * Math.pow(2.1, i))
      this.essence += reward
      this.totalEarned += reward
      this.allTime += reward
      this.runEarned += reward
      this.logEvent(`Achievement ${a.name}`, '🏆')
      this.emit('achievement', { a, reward })
    }
  }

  checkLogin() {
    const today = this._dailyKey()
    if (this.lastLoginDate === today) return null

    const yest = new Date()
    yest.setDate(yest.getDate() - 1)
    const yKey = yest.getFullYear() + '-' + String(yest.getMonth() + 1).padStart(2, '0') + '-' + String(yest.getDate()).padStart(2, '0')

    this.loginStreak = this.lastLoginDate === yKey ? this.loginStreak + 1 : 1
    this.lastLoginDate = today

    const ess = Math.max(500, Math.round((this.passive || 1) * 120))
    const fl = this.loginStreak >= 3 ? 1 : 0
    this.essence += ess
    this.totalEarned += ess
    this.allTime += ess
    if (fl) { this.flowers += fl }
    return { ess, fl, streak: this.loginStreak }
  }

  exportSave() {
    this.save()
    try { return localStorage.getItem(SAVE_KEY) } catch (e) { return null }
  }

  importSave(str) {
    try {
      const d = JSON.parse(str)
      if (typeof d.e !== 'number' || typeof d.l !== 'object') return false
      localStorage.setItem(SAVE_KEY, JSON.stringify(d))
      return true
    } catch (e) { return false }
  }

  addXp(n) {
    if (!Number.isFinite(this.xp)) this.xp = 0
    if (!Number.isFinite(n)) n = 0
    this.xp += n * (this.xpMul || 1)
    let guard = 0
    while (this.xp >= this.xpNeed(this.gLevel + 1) && guard++ < 500) {
      this.xp -= this.xpNeed(this.gLevel + 1)
      this.gLevel++
      const reward = Math.round(60 * Math.pow(this.gLevel, 1.6))
      this.essence += reward
      this.totalEarned += reward
      this.emit('levelup', { lvl: this.gLevel, reward })
    }
  }

  recalc() {
    const L = id => this.lvl(id)

    const catN = { nature: 0, lights: 0, buildings: 0, decor: 0, fauna: 0 }
    let distinct = 0
    for (const p of this.placements) {
      const c = String(p.t || '').split('/')[0]
      if (c in catN) {
        const w = 1 + (((p.v || 1) - 1) * 0.35)
        if (catN[c] === 0) distinct++
        catN[c] += w
      }
    }
    this._catN = catN
    this._distinct = distinct
    this.xpMul = 1 + catN.decor * 0.02

    const SYN_RECIPES = [
      ['nature', 'lights', 'lentera'],
      ['buildings', 'nature', 'kuil'],
      ['decor', 'buildings', 'desa'],
      ['fauna', 'nature', 'satwa']
    ]
    const pts = this.placements.map(p => ({ c: String(p.t || '').split('/')[0], t: p.t, x: p.x, z: p.z }))
    const byCat = {}
    pts.forEach((p, i) => { (byCat[p.c] || (byCat[p.c] = [])).push(i) })
    const syn = { lentera: 0, kuil: 0, desa: 0, satwa: 0 }
    for (const [ca, cb, key] of SYN_RECIPES) {
      const ia = byCat[ca] || [], ib = byCat[cb] || []
      let n = 0
      for (const i of ia) {
        if (ib.some(j => Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) <= 4)) n++
        if (n >= 15) break
      }
      syn[key] = n
    }
    this._syn = syn

    const UNIQUE_SYNERGIES = [
      { id: 'sakura_gate', name: 'Gerbang Sakura', a: ['buildings/torii_gate'], b: ['nature/pohon_sakura'], bonus: { tap: 0.04 } },
      { id: 'gold_light', name: 'Gerbang Cahaya', a: ['buildings/golden_torii'], b: ['lights/lentera_suar'], bonus: { passive: 0.03 } },
      { id: 'butterfly_bridge', name: 'Jembatan Kupu', a: ['decor/jembatan_taiko'], b: ['fauna/kupu_kupu'], bonus: { xp: 0.02 } },
      { id: 'farm_house', name: 'Rumah Petani', a: ['buildings/rumah_kayu_klasik'], b: ['decor/petak_ladang'], bonus: { flat: 1.5 } },
      { id: 'forest_fort', name: 'Benteng Hutan', a: ['buildings/benteng_batu'], b: ['nature/pohon_raksasa_kuno'], bonus: { passive: 0.04 } }
    ]
    const uniqActive = []
    for (const u of UNIQUE_SYNERGIES) {
      const hasA = pts.some(p => u.a.includes(p.t))
      const hasB = pts.some(p => u.b.includes(p.t))
      if (!hasA || !hasB) continue
      const pa = pts.filter(p => u.a.includes(p.t))
      const pb = pts.filter(p => u.b.includes(p.t))
      if (pa.some(p1 => pb.some(p2 => Math.hypot(p1.x - p2.x, p1.z - p2.z) <= 5))) {
        uniqActive.push(u)
      }
    }
    this._uniq = uniqActive
    let uniqTapMul = 1, uniqPassiveAdd = 0, uniqXpAdd = 0, uniqFlatAdd = 0
    for (const u of uniqActive) {
      const b = u.bonus
      if (b.tap) uniqTapMul *= 1 + b.tap
      if (b.passive) uniqPassiveAdd += b.passive
      if (b.xp) uniqXpAdd += b.xp
      if (b.flat) uniqFlatAdd += b.flat
    }
    const newOnes = uniqActive.filter(u => !this.discSyn.includes(u.id))
    if (newOnes.length) {
      this.discSyn.push(...newOnes.map(u => u.id))
      for (const u of newOnes) this.logEvent(`⚡ Sinergi: ${u.name}`, '⚡')
      this.emit('synergy', { ids: newOnes.map(u => u.id) })
    }

    let tapBase = 1 + L('chimes') * 0.25 + L('butterflies') * 0.35
    if (L('sakura')) tapBase *= 1.2
    tapBase *= 1 + catN.lights * 0.03
    tapBase *= 1 + syn.lentera * 0.01
    tapBase *= uniqTapMul

    let flat = L('lotus') * 0.5 + L('lanterns') * 2 + L('koi') * 6 +
      L('butterflies') * 3 + L('spirits') * 30 + L('cranes') * 120 +
      catN.nature * 2 +
      (this.domains.dawn ? 40 : 0) + (this.domains.jade ? 600 : 0) + L('rabbit') * 2500 +
      (this.domains.lotus ? 150 : 0) + (this.domains.star ? 450 : 0)
    flat += uniqFlatAdd
    let flatBonus = 0
    let multPassiveAdd = 0
    let mult = Math.pow(1.25, L('fox')) *
      Math.pow(2, L('phoenix')) * (L('cloudsea') ? 1.3 : 1) *
      (L('goldenkoi') ? 1.4 : 1) * (L('dragon') ? 3 : 1) *
      (1 + this.stars * 0.35)
    mult *= 1 + catN.buildings * 0.04
    mult *= 1 + distinct * 0.03
    mult *= 1 + syn.kuil * 0.03
    mult *= 1 + uniqPassiveAdd
    if (this.flowers) mult *= 1 + this.flowers * 0.02

    // Toko Bunga Abadi
    const FU = this.flowerUp || {}
    tapBase *= 1 + (FU.tap || 0) * 0.15
    mult *= 1 + (FU.pasif || 0) * 0.04
    this._evBoost = FU.event || 0
    this.xpMul += syn.desa * 0.01 + uniqXpAdd

    if (flatBonus) flat += flatBonus
    if (multPassiveAdd) mult *= 1 + multPassiveAdd

    // ---- Gelar Taman (skor keindahan → bonus permanen) ----
    let gScore = this.placements.length * 2 + (this._distinct || 0) * 15
    gScore += ((this._syn?.lentera || 0) + (this._syn?.kuil || 0) + (this._syn?.desa || 0) + (this._syn?.satwa || 0)) * 8
    gScore += (this._uniq || []).length * 25
    for (const p of this.placements) gScore += (((p.v || 1) - 1) * 10)
    gScore += ['dawn', 'jade', 'lotus', 'star'].filter(k => this.domains[k]).length * 20
    const TITLES = ['Taman Kecil', 'Taman Menawan', 'Taman Istimewa', 'Taman Luar Biasa', 'Taman Legendaris', 'Taman Kayangan']
    const MINS = [0, 50, 120, 250, 450, 700]
    let curIdx = 0
    for (let i = MINS.length - 1; i >= 0; i--) { if (gScore >= MINS[i]) { curIdx = i; break } }
    this.bestRank = Math.max(this.bestRank || 0, curIdx)
    if (Number.isFinite(this.rankSeen) && curIdx > this.rankSeen) {
      this.logEvent(`🏅 Gelar naik: ${TITLES[curIdx]}`, '🏅')
      this.emit('gardentitle', { name: TITLES[curIdx], score: gScore })
    }
    this.rankSeen = Math.max(this.rankSeen ?? -1, curIdx)
    this._gTitle = { score: gScore, idx: this.bestRank, name: TITLES[this.bestRank] }
    mult *= 1 + this.bestRank * 0.03

    if (this.rainOn && L('rain')) flat *= 1.5
    this.tapValue = tapBase * mult
    this.passive = flat * mult
  }

  placedCounts() {
    return this._catN || { nature: 0, lights: 0, buildings: 0, decor: 0, fauna: 0 }
  }

  gardenTitle() { return this._gTitle || { score: 0, idx: 0, name: 'Taman Kecil' } }
  tick(dt) {
    if (this.passive <= 0) return
    const m = this.buffActive() ? 2 : 1
    const amt = this.passive * dt * m
    this.essence += amt
    this.totalEarned += amt
    this.allTime += amt
    this.runEarned += amt
    this.counters.collected += amt
    this.questEvent('collect', amt)
  }

  canBuy(id) {
    const u = U_BY_ID[id]
    return this.lvl(id) < u.max &&
      this.gLevel >= (u.minLv || 1) &&
      this.essence >= this.cost(id)
  }

  buy(id) {
    if (!this.canBuy(id)) return false
    const cst = this.cost(id)
    this.essence -= cst
    this.levels[id] = this.lvl(id) + 1
    this.recalc()
    this.addXp(Math.ceil(Math.pow(cst, 0.42)))
    this.questEvent('buys')
    this.emit('buy', { id, lvl: this.levels[id] })
    return true
  }

  isleExp(key) { return key === 'star' ? (this.domains.starX | 0) : (this.domains[key + 'X'] | 0) }

  getDomainOffers() {
    const out = []
    const nextStage = (this.domains.main || 1) + 1
    out.push({
      id: 'main',
      kind: 'expandMain',
      stage: nextStage,
      icon: '🌾',
      name: `Perluas Pulau · Tahap ${nextStage}`,
      desc: `Radius ${mainIslandRadius(nextStage - 1)} → ${mainIslandRadius(nextStage)}`,
      cost: mainStageCost(nextStage),
      minLv: mainStageMinLv(nextStage)
    })
    out.push({
      id: 'slots',
      kind: 'slots',
      n: (this.slotBonus | 0) + 1,
      icon: '🧩',
      name: `Slot Taman · +5`,
      desc: `Kuota penempatan ${this.slots()} → ${this.slots() + 5}`,
      cost: this.slotCost((this.slotBonus | 0) + 1),
      minLv: 1 + ((this.slotBonus | 0) + 1)
    })
    for (const I of ISLES) {
      if (!this.domains[I.key]) {
        out.push({
          id: 'isle:' + I.key,
          kind: 'island',
          isle: I.key,
          icon: I.icon,
          name: `Domain: ${I.name}`,
          desc: `Pulau baru · +${I.rate}/s`,
          cost: I.cost,
          minLv: I.minLv
        })
      } else {
        const next = this.isleExp(I.key) + 1
        out.push({
          id: 'exp:' + I.key,
          kind: 'expandIsle',
          isle: I.key,
          exp: next,
          icon: I.icon,
          name: `${I.name} · Luas ${next}`,
          desc: `Radius ${I.baseR + this.isleExp(I.key) * 2} → ${I.baseR + next * 2}`,
          cost: isleExpCost(I, next),
          minLv: isleExpMinLv(I, next)
        })
      }
    }
    return out
  }

  canBuyDomain(id) {
    const o = this.getDomainOffers().find(x => x.id === id)
    if (!o) return false
    return this.gLevel >= (o.minLv || 1) && this.essence >= o.cost
  }

  buyDomain(id) {
    const offer = this.getDomainOffers().find(x => x.id === id)
    if (!offer || !this.canBuyDomain(id)) return null
    this.essence -= offer.cost
    if (offer.kind === 'expandMain') this.domains.main = offer.stage
    else if (offer.kind === 'slots') this.slotBonus = offer.n
    else if (offer.kind === 'island') this.domains[offer.isle] = true
    else if (offer.isle === 'star') this.domains.starX = offer.exp
    else this.domains[offer.isle + 'X'] = offer.exp
    this.recalc()
    this.addXp(Math.ceil(Math.pow(offer.cost, 0.42)))
    this.questEvent('buys')
    this.emit('domain', { id: offer.id, kind: offer.kind })
    return offer
  }

  storeCopies(id) {
    const v = this.storeOwned[id]
    if (typeof v === 'number' && v > 0) return Math.floor(v)
    if (v === true) return 1
    return 0
  }

  ownsStoreItem(id) { return this.storeCopies(id) > 0 }

  buyStoreItem(id, price) {
    const cur = this.storeCopies(id)
    if (!Number.isFinite(price) || price <= 0 || this.essence < price) return false
    this.essence -= price
    this.storeOwned[id] = cur + 1
    this.addXp(Math.ceil(Math.pow(price, 0.42)))
    this.questEvent('buys')
    this.emit('storebuy', { id })
    return true
  }

  addTap(mult = 1) {
    const m = this.buffActive() ? 2 : 1
    const amt = this.tapValue * mult * m
    this.essence += amt
    this.totalEarned += amt
    this.allTime += amt
    this.runEarned += amt
    this.taps++
    this.questEvent('taps')
    this.addXp(1)
    return amt
  }

  setRain(on) {
    this.rainOn = on
    this.recalc()
  }

  serialize() {
    return {
      e: this.essence,
      t: this.totalEarned,
      tp: this.taps,
      l: this.levels,
      dm: this.domains,
      pt: this.pgTier,
      so: this.storeOwned,
      fg: this.forgeAssets,
      tp2: this.tips,
      sb: this.slotBonus,
      hi: this.history,
      gd: this.guide,
      ds: this.discSyn,
      dd: this.daily,
      br: this.bestRank,
      fu: this.flowerUp,
      ls: this.loginStreak,
      ld: this.lastLoginDate,
      m: this.muted,
      r: this.rainOn,
      x: this.xp,
      g: this.gLevel,
      pl: this.placements,
      st: this.stars,
      ac: this.ascensions,
      fl: this.flowers,
      at: this.allTime,
      re: this.runEarned,
      bu: this.buffUntil,
      qc: this.counters,
      qs: this.quests,
      ah: this.ach,
      last: Date.now()
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize()))
    } catch (e) { }
  }

  readLocalRaw() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY))
      return d || null
    } catch (e) { return null }
  }

  adoptRemote(obj) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(obj)) } catch (e) { }
  }

  load() {
    let data = null
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)) } catch (e) { }
    if (!data || typeof data !== 'object') return null
    const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
    this.essence = num(data.e, 0)
    this.totalEarned = num(data.t, 0)
    this.taps = num(data.tp, 0)
    if (!data.l || typeof data.l !== 'object' || Array.isArray(data.l)) data.l = {}
    for (const k in data.l) {
      if (typeof data.l[k] !== 'number' || !Number.isFinite(data.l[k]) || data.l[k] < 0) delete data.l[k]
    }
    this.levels = data.l
    this.muted = !!data.m

    const legacyPagoda = Number.isFinite(data.l.pagoda) ? Math.max(0, Math.floor(data.l.pagoda)) : 0
    if (data.dm && typeof data.dm === 'object' && !Array.isArray(data.dm)) {
      const f = freshDomains()
      for (const k of Object.keys(f)) {
        const v = data.dm[k]
        if (k === 'main') f.main = Math.max(1, Math.min(9999, Math.floor(Number(v) || 1)))
        else if (typeof v === 'boolean') f[k] = v
        else if (Number.isFinite(v)) f[k] = Math.max(0, Math.min(999, Math.floor(v)))
      }
      this.domains = f
    } else {
      this.domains = freshDomains()
      this.domains.main = Math.max(1, Math.min(4, legacyPagoda || 1))
      if (data.l.bridge > 0) this.domains.dawn = true
      if (data.l.jade > 0) this.domains.jade = true
      if (data.l.lotusisle > 0) this.domains.lotus = true
      if (data.l.starpeak > 0) this.domains.star = true
    }
    this.pgTier = Math.max(1, Math.min(5, Math.floor(Number(data.pt) || 1 + Math.min(4, legacyPagoda))))
    this.storeOwned = data.so && typeof data.so === 'object' && !Array.isArray(data.so)
      ? Object.fromEntries(Object.entries(data.so).filter(([, v]) => v === true || (Number.isFinite(v) && v > 0)))
      : {}
    this.forgeAssets = Array.isArray(data.fg)
      ? data.fg.filter(a => a && typeof a === 'object' && typeof a.d === 'string' && Array.isArray(a.pal) && Array.isArray(a.pos))
      : []
    this.tips = data.tp2 && typeof data.tp2 === 'object' && !Array.isArray(data.tp2) ? data.tp2 : {}
    this.slotBonus = Math.max(0, Math.floor(num(data.sb, 0)))
    this.history = Array.isArray(data.hi)
      ? data.hi.filter(h => h && typeof h === 'object' && typeof h.txt === 'string' && Number.isFinite(h.ts)).slice(0, 80)
      : []
    this.guide = data.gd && typeof data.gd === 'object' && !Array.isArray(data.gd) ? data.gd : {}
    this.discSyn = Array.isArray(data.ds) ? data.ds.filter(x => typeof x === 'string') : []
    this.daily = data.dd && typeof data.dd === 'object' && typeof data.dd.date === 'string' && Array.isArray(data.dd.list)
      ? data.dd
      : null
    this.flowerUp = data.fu && typeof data.fu === 'object' && !Array.isArray(data.fu)
      ? Object.fromEntries(Object.entries(data.fu).filter(([, v]) => Number.isFinite(v) && v > 0))
      : {}
    this.loginStreak = Math.max(0, Math.floor(num(data.ls, 0)))
    this.lastLoginDate = typeof data.ld === 'string' ? data.ld.slice(0, 10) : ''
    this.rainOn = !!data.r

    this.xp = num(data.x, 0)
    this.gLevel = Math.max(1, Math.floor(num(data.g, 1)))
    this.placements = Array.isArray(data.pl)
      ? data.pl.filter(p => p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.z))
      : []
    this.stars = Math.max(0, Math.floor(num(data.st, 0)))
    this.ascensions = Math.max(0, Math.floor(num(data.ac, 0)))
    this.flowers = Math.max(0, Math.floor(num(data.fl, 0)))
    this.bestRank = Math.max(0, Math.floor(num(data.br, 0)))
    this.allTime = num(data.at, 0)
    this.runEarned = num(data.re, 0)
    this.buffUntil = num(data.bu, 0)
    if (data.qc && typeof data.qc === 'object' && !Array.isArray(data.qc)) this.counters = { ...this.counters, ...data.qc }
    this.quests = Array.isArray(data.qs)
      ? data.qs.filter(q => q && typeof q === 'object').map(q => ({ prog: 0, done: false, claimed: false, reward: { essence: 0, xp: 0 }, ...q }))
      : []
    this.ach = data.ah && typeof data.ah === 'object' && !Array.isArray(data.ah) ? data.ah : {}
    this.ensureQuests()
    this.recalc()
    this.rankSeen = this._gTitle?.idx ?? 0
    const last = num(data.last, 0)
    const awaySecs = last ? Math.min((Date.now() - last) / 1000, (8 + this.flowerUpLv('time') * 4) * 3600) : 0
    if (awaySecs < 0 || !Number.isFinite(awaySecs)) return { awaySecs: 0, gained: 0 }
    const gained = awaySecs > 30 ? this.passive * awaySecs * 0.5 : 0
    if (gained > 0) {
      this.essence += gained
      this.totalEarned += gained
      this.allTime += gained
      this.runEarned += gained
    }
    return { awaySecs, gained }
  }

  reset() {
    try { localStorage.removeItem(SAVE_KEY) } catch (e) { }
  }
}
