export const UPGRADES = [
  { id: 'lotus', icon: '🪷', name: 'Sacred Lotus', desc: '+0.5 essence/s each', base: 25, growth: 1.5, max: 50, minLv: 1 },
  { id: 'chimes', icon: '🎐', name: 'Wind Chimes', desc: '+0.25 per tap each', base: 15, growth: 1.45, max: 100, minLv: 1 },
  { id: 'lanterns', icon: '🏮', name: 'Sky Lanterns', desc: '+2/s each · more lanterns drift above', base: 200, growth: 1.55, max: 40, minLv: 1 },
  { id: 'butterflies', icon: '🦋', name: 'Glow Butterflies', desc: '+3/s and +0.35 tap each', base: 400, growth: 1.5, max: 30, minLv: 1 },
  { id: 'koi', icon: '🐟', name: 'Koi Companions', desc: '+6/s each · they swim the pond', base: 750, growth: 1.6, max: 20, minLv: 1 },
  { id: 'pagoda', icon: '🗼', name: 'Pagoda Ascension', desc: '×1.5 everything · raises the pagoda', base: 2500, growth: 4.5, max: 4, minLv: 2 },
  { id: 'fox', icon: '🦊', name: 'Sleepy Fox Spirit', desc: '×1.25 everything · naps on a stone', base: 5000, growth: 3.2, max: 4, minLv: 2 },
  { id: 'bridge', icon: '⛩️', name: 'Bridge of Dawn', desc: 'reveals the Torii Isle · +40/s', base: 15000, growth: 1, max: 1, minLv: 3 },
  { id: 'sakura', icon: '🌸', name: 'Sakura Breeze', desc: '×1.2 taps · petals fill the air', base: 30000, growth: 1, max: 1, minLv: 3 },
  { id: 'rain', icon: '🌧️', name: 'Monsoon Blessing', desc: 'unlocks gentle rain · ×1.5 while raining', base: 60000, growth: 1, max: 1, minLv: 4 },
  { id: 'incense', icon: '🔥', name: 'Bronze Incense Burner', desc: 'tap the burner by the pagoda · ×2 essence for 60s', base: 15000, growth: 3, max: 3, minLv: 3 },
  { id: 'cloudsea', icon: '☁️', name: 'Cloud Sea', desc: '×1.3 everything · thickens the cloud sea below', base: 80000, growth: 1, max: 1, minLv: 4 },
  { id: 'spirits', icon: '✨', name: 'Forest Spirits', desc: '+30/s each · wisps wander the garden', base: 120000, growth: 1.7, max: 20, minLv: 4 },
  { id: 'cranes', icon: '🕊️', name: 'Immortal Cranes', desc: '+120/s each · glide between the isles', base: 250000, growth: 2.6, max: 2, minLv: 5 },
  { id: 'goldenkoi', icon: '🐠', name: 'Golden Koi Blessing', desc: 'the koi shimmer gold · ×1.4 everything', base: 500000, growth: 1, max: 1, minLv: 5 },
  { id: 'jade', icon: '🏯', name: 'Jade Terrace Isle', desc: 'reveals the celestial pavilion isle · +600/s', base: 900000, growth: 1, max: 1, minLv: 6 },
  { id: 'lotusisle', icon: '🪷', name: 'Lotus Haven Isle', desc: 'stepping-stones to a quiet lotus pond isle · +150/s', base: 120000, growth: 1, max: 1, minLv: 4 },
  { id: 'starpeak', icon: '🌟', name: 'Star Peak Summit', desc: 'rope bridge up to the celestial gazebo · +450/s', base: 900000, growth: 1, max: 1, minLv: 6 },
  { id: 'phoenix', icon: '🔥', name: 'Legendary Phoenix', desc: '×2 everything · circles the pagoda', base: 2000000, growth: 5, max: 3, minLv: 7 },
  { id: 'rabbit', icon: '🐇', name: 'Moon Rabbit', desc: '+2500/s · pounds the elixir of immortality', base: 6000000, growth: 1, max: 1, minLv: 8 },
  { id: 'dragon', icon: '🐉', name: 'Azure Celestial Dragon', desc: '×3 everything · dances through the heavens', base: 25000000, growth: 6, max: 1, minLv: 10 }
]

export const LEVEL_UNLOCKS = {
  2: '🔨 Build Mode unlocked',
  3: '⛩️ New blueprints & Bridge of Dawn',
  4: '🌧️ Monsoon & Cloud Sea',
  5: '🕊️ Immortal Cranes & Golden Koi',
  6: '🏯 Jade Terrace Isle',
  7: '🔥 Legendary Phoenix',
  8: '🐇 Moon Rabbit',
  9: '✨ Greater spirits',
  10: '🐉 AZURE CELESTIAL DRAGON'
}

const U_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]))
const SAVE_KEY = 'sakura-sky-garden-v1'

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
    this.muted = false
    this.rainOn = false
    this.xp = 0
    this.gLevel = 1
    this.placements = []
    this.stars = 0
    this.ascensions = 0
    this.allTime = 0
    this.runEarned = 0
    this.buffUntil = 0
    this.counters = { collected: 0, taps: 0, placed: 0, buys: 0, harvests: 0 }
    this.quests = []
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

  slots() { return 6 + this.gLevel * 2 + this.ascensions * 3 }

  buffActive() { return Date.now() < this.buffUntil }
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

  addXp(n) {
    this.xp += n
    while (this.xp >= this.xpNeed(this.gLevel + 1)) {
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
    let tapBase = 1 + L('chimes') * 0.25 + L('butterflies') * 0.35
    if (L('sakura')) tapBase *= 1.2
    let flat = L('lotus') * 0.5 + L('lanterns') * 2 + L('koi') * 6 +
      L('butterflies') * 3 + L('spirits') * 30 + L('cranes') * 120 +
      (L('bridge') ? 40 : 0) + (L('jade') ? 600 : 0) + (L('rabbit') ? 2500 : 0) +
      (L('lotusisle') ? 150 : 0) + (L('starpeak') ? 450 : 0)
    let mult = Math.pow(1.25, L('fox')) * Math.pow(1.5, L('pagoda')) *
      Math.pow(2, L('phoenix')) * (L('cloudsea') ? 1.3 : 1) *
      (L('goldenkoi') ? 1.4 : 1) * (L('dragon') ? 3 : 1) *
      (1 + this.stars * 0.35)
    if (this.rainOn && L('rain')) flat *= 1.5
    this.tapValue = tapBase * mult
    this.passive = flat * mult
  }

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

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        e: this.essence,
        t: this.totalEarned,
        tp: this.taps,
        l: this.levels,
        m: this.muted,
        r: this.rainOn,
        x: this.xp,
        g: this.gLevel,
        pl: this.placements,
        st: this.stars,
        ac: this.ascensions,
        at: this.allTime,
        re: this.runEarned,
        bu: this.buffUntil,
        qc: this.counters,
        qs: this.quests,
        last: Date.now()
      }))
    } catch (e) { }
  }

  load() {
    let data = null
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)) } catch (e) { }
    if (!data) return null
    this.essence = data.e || 0
    this.totalEarned = data.t || 0
    this.taps = data.tp || 0
    this.levels = data.l || {}
    this.muted = !!data.m
    this.rainOn = !!data.r
    this.xp = data.x || 0
    this.gLevel = Math.max(1, data.g || 1)
    this.placements = Array.isArray(data.pl) ? data.pl : []
    this.stars = data.st || 0
    this.ascensions = data.ac || 0
    this.allTime = data.at || 0
    this.runEarned = data.re || 0
    this.buffUntil = data.bu || 0
    if (data.qc) this.counters = { ...this.counters, ...data.qc }
    this.quests = Array.isArray(data.qs) ? data.qs : []
    this.ensureQuests()
    this.recalc()
    const awaySecs = data.last ? Math.min((Date.now() - data.last) / 1000, 8 * 3600) : 0
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
