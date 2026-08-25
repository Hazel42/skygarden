import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

import { VoxelSystem, voxelUniforms } from './voxel.js'
import { World } from './world.js'
import { Fauna } from './fauna.js'
import { FX } from './fx.js'
import { DayNight } from './daynight.js'
import { GameState, LEVEL_UNLOCKS, FLOWER_UPGRADES, fmt } from './state.js'
import { Builder } from './build.js'
import { UI } from './ui.js'
import { audio } from './audio.js'
import { createCloudSea } from './cloudsea.js'
import { DockUI } from './dockui.js'
import { RadialMenu } from './radial.js'
import { cloud, isValidRemoteSave } from './cloud.js'
import { VoxelForge } from './forge/forge.js'

const BOOT_VERSION = 'boot-v3-safe'
const boot = { stage: 'init', t0: performance.now(), done: false }
window.__gardenBoot = boot

const introEl = () => document.getElementById('introLoad')
const bootLog = m => {
  boot.stage = m
  const el = introEl()
  if (el) el.textContent = m
}
const showBootError = msg => {
  const el = introEl()
  if (!el) return
  el.innerHTML =
    '⚠️ ' + (msg || 'unknown error') +
    `<br><a href="#" id="safeStart" style="color:#ffd9a8;text-decoration:underline;font-weight:700">🧹 Safe Start — bersihkan data lokal & muat ulang</a>` +
    `<br><span style="font-size:10px;opacity:.7">${BOOT_VERSION} · ${Math.round(performance.now() - boot.t0)}ms</span>`
  el.style.color = '#ffb3b3'
  document.getElementById('safeStart')?.addEventListener('click', e => {
    e.preventDefault()
    try { localStorage.clear(); sessionStorage.clear() } catch (err) { }
    location.reload()
  })
}
window.addEventListener('error', e => {
  if (!boot.done) showBootError(e.message || 'script error')
})
window.addEventListener('unhandledrejection', e => {
  if (!boot.done) console.warn('[boot] rejection:', e.reason)
})
const watchdog = setInterval(() => {
  if (boot.done || performance.now() - boot.t0 < 9000) return
  clearInterval(watchdog)
  showBootError('boot macet di fase: ' + boot.stage)
}, 1000)

const canvas = document.getElementById('scene')
bootLog('🌱 waking the renderer…')
let renderer
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
} catch (e) {
  showBootError('WebGL gagal dimulai — perangkat/driver GPU tidak mendukung. (' + (e.message || e) + ')')
  throw e
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500)
camera.position.set(36, 26, 42)

const hemi = new THREE.HemisphereLight('#BFE3F2', '#6B5A4C', 0.6)
scene.add(hemi)
const sunLight = new THREE.DirectionalLight('#FFF2D8', 1.15)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(2048, 2048)
Object.assign(sunLight.shadow.camera, { left: -42, right: 42, top: 58, bottom: -30, near: 5, far: 170 })
sunLight.shadow.camera.updateProjectionMatrix()
sunLight.shadow.bias = -0.0004
sunLight.shadow.normalBias = 0.5
scene.add(sunLight)
scene.add(sunLight.target)

const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  samples: 4, type: THREE.HalfFloatType
})
const composer = new EffectComposer(renderer, rt)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.55, 0.75, 0.85
)
composer.addPass(bloom)
composer.addPass(new OutputPass())

const sys = new VoxelSystem()
bootLog('🌱 growing the island…')
const world = new World(sys, scene)
const cloudSea = createCloudSea(scene)
const fx = new FX(scene, world.anchors)
const fauna = new Fauna(scene, world.anchors)
bootLog('🕊️ waking creatures…')
fauna.onEmber = p => fx.spawnSpark(p)
fauna.onDragonSpark = p => fx.spawnSpark(p, ['#BFFFE0', '#8FD8E8', '#DFF6FF'])
fauna.onDragonCall = () => audio.dragonCall()

const state = new GameState()

function setCloudIndicator(s) {
  const el = document.getElementById('cloudState')
  if (!el) return
  el.classList.remove('hidden')
  if (s === 'sync') { el.textContent = '☁️ syncing…'; el.className = 'cloudsync' }
  else if (s === 'on') { el.textContent = '☁️ ✓'; el.className = 'cloudon' }
  else if (s === 'err') { el.textContent = '☁️ ⚠'; el.className = 'clouderr' }
  else { el.classList.add('hidden') }
}

const cloudReady = cloud.init()
setCloudIndicator('sync')
bootLog('☁️ connecting cloud save…')
const builder = new Builder(scene, world, state, {
  onPlaced(item, pos) {
    audio.placeSound(item?.cat || 'decor')
    fx.burst(pos.clone().setY(pos.y + 1.2), 'poof')
    state.questEvent('placed')
    markGuide('place')
    state.logEvent(`Tempatkan ${item?.name || 'objek'}`, '🔨')
    tipOnce('longpress', '💡 Tahan klik pada objek kapan saja: pindah, atur ukuran/rotasi, atau simpan ke storage')
    state.save()
  },
  onRemoved(item, pos) {
    if (item?.name) state.logEvent(`Lepas ${item.name}`, '↩️')
    fx.spawnDebris(pos.clone().setY(pos.y + 0.5), '#8A5A3B', 10)
    fx.burst(pos.clone().setY(pos.y + 1), 'poof')
    audio.tap(4)
    state.save()
  }
})

function makePoint(color, base, dist) {
  const L = new THREE.PointLight(color, 0, dist, 2)
  L.userData.base = base
  scene.add(L)
  return L
}
const pagodaLight = makePoint('#FFB36B', 1.3, 16)
pagodaLight.position.copy(world.anchors.pagodaDoor)
const toroLight = makePoint('#FFCF8A', 1.05, 12)
if (world.anchors.toroLights[0]) toroLight.position.copy(world.anchors.toroLights[0])
else toroLight.position.copy(world.anchors.pagodaDoor)
const lotusLight = makePoint('#FF9EC8', 0.65, 10)
lotusLight.position.copy(world.anchors.lotusLight)

const daynight = new DayNight(scene, {
  hemi,
  sunLight,
  winMat: sys.winMat,
  lanternLights: [pagodaLight, toroLight, lotusLight],
  renderer
})

const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 7, 0)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 12
controls.maxDistance = 85
controls.maxPolarAngle = Math.PI * 0.495
controls.minPolarAngle = 0.12
controls.autoRotateSpeed = 0.45
controls.screenSpacePanning = false

const sleep = ms => new Promise(r => setTimeout(r, ms))
let started = false
let lastInteract = performance.now()

let offline = state.load()
const introLoad = document.getElementById('introLoad')

function restoreWorldFromState() {
  try {
    syncWorldToState()
    builder.loadList(state.placements)
    ui.renderUpgrades()
    ui.renderBuild()
    ui.renderQuests()
  } catch (e) {
    console.warn('[cloud] world restore failed:', e)
  }
}

function syncDomainsToWorld(animated) {
  const D = state.domains
  world.setIslandStage(D.main || 1)
  if (D.dawn) world.revealBridge(animated)
  else { world.isleRevealed = false; world.isleGroup.visible = false }
  if (D.jade) world.revealJade(animated)
  else { world.jadeRevealed = false; if (world.jadeGroup) world.jadeGroup.visible = false }
  if (D.lotus) world.revealLotus(animated)
  else { world.lotusRevealed = false; if (world.lotusGroup) world.lotusGroup.visible = false }
  if (D.star) world.revealStar(animated)
  else { world.starRevealed = false; if (world.starGroup) world.starGroup.visible = false }
  world.setDawnExp(D.dawnX | 0)
  world.setJadeExp(D.jadeX | 0)
  world.setLotusExp(D.lotusX | 0)
  world.setStarExp(D.starX | 0)
}

let profile = null
let syncingAccount = false

function friendlyAuthError(err) {
  const m = String(err?.message || err || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email atau password salah.'
  if (m.includes('already registered')) return 'Email sudah terdaftar — silakan Sign in.'
  if (m.includes('not confirmed')) return 'Email belum dikonfirmasi — cek inbox Anda.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Terlalu banyak percobaan — coba lagi nanti.'
  if (m.includes('password')) return 'Password minimal 6 karakter.'
  return 'Gagal: ' + (err?.message || err)
}

async function refreshProfileUI() {
  profile = await Promise.race([cloud.getProfile(), sleep(2500).then(() => null)])
  ui.updateAuthUI({ isGuest: cloud.isGuest, email: cloud.email, profile })
}

async function mergeProgressAfterLogin() {
  const remote = await Promise.race([cloud.pull(), sleep(3000).then(() => null)])
  const cur = state.readLocalRaw()
  lastCloudStr = ''
  if (isValidRemoteSave(remote)) {
    const sameAsLocal = cur && Math.abs((cur.last || 0) - (remote.last || 0)) < 2000
    if (!sameAsLocal) {
      state.adoptRemote(remote)
      offline = state.load() || offline
      restoreWorldFromState()
      ui.toast('☁️ Progres akun dimuat dari cloud')
    }
  } else if (cur) {
    const okPush = await Promise.race([cloud.push(state.serialize()), sleep(4000).then(() => false)])
    ui.toast(okPush ? '☁️ Progres tamu dipindah ke akun' : '⚠️ Gagal sinkron progres tamu')
  }
}

cloud.onChange = async event => {
  try {
    if (event === 'SIGNED_OUT') {
      await cloud.ensureSession()
      lastCloudStr = ''
      profile = null
      ui.updateAuthUI({ isGuest: true, email: null, profile: null })
      setCloudIndicator(cloud.ok ? 'on' : '')
      ui.toast('👤 Bermain sebagai tamu')
      return
    }
    if (event === 'SIGNED_IN') {
      if (!syncingAccount) {
        syncingAccount = true
        try {
          await mergeProgressAfterLogin()
          await refreshProfileUI()
        } finally { syncingAccount = false }
        if (!started) ui.toast('👤 Akun terhubung — progres tersimpan aman')
      }
      return
    }
  } catch (e) {
    console.warn('[auth] change failed:', e)
  }
}

async function connectCloudSave() {
  try {
    const ok = await Promise.race([cloudReady, sleep(3000).then(() => false)])
    if (!ok) { setCloudIndicator(''); return }
    setCloudIndicator('on')
    await flushOutbox()
    const remoteSave = await Promise.race([cloud.pull(), sleep(3000).then(() => null)])
    if (!isValidRemoteSave(remoteSave)) return
    const cur = state.readLocalRaw()
    if (cur && (cur.last || 0) >= (remoteSave.last || 0)) return
    state.adoptRemote(remoteSave)
    offline = state.load() || offline
    restoreWorldFromState()
    if (!started) {
      if (introLoad) introLoad.textContent = '☁️ cloud save restored'
      if (offline && offline.gained >= 1) {
        setTimeout(() => ui.toast(`Welcome back · +${fmt(offline.gained)} ✨ gathered while away`), 900)
      }
    }
    await refreshProfileUI()
  } catch (e) {
    setCloudIndicator(cloud.ok ? 'on' : '')
  }
}

function lanternTarget() {
  const stg = state.domains.main || 1
  const base = stg <= 1 ? 0 : Math.min(8, 2 + stg)
  return base + Math.min(3, Math.floor(state.lvl('lanterns') / 5))
}

function syncWorldToState() {
  world.setPagodaTier(state.pgTier)
  syncDomainsToWorld(false)
  fauna.setKoi(Math.min(state.lvl('koi'), 8))
  fauna.setButterflies(Math.min(state.lvl('butterflies'), 12))
  fauna.setWisps(Math.min(10, Math.ceil(state.lvl('spirits') / 2)))
  fauna.setFox(state.lvl('fox') > 0, !!state.domains.dawn)
  fauna.setPhoenix(state.lvl('phoenix') > 0)
  fauna.setCranes(Math.min(state.lvl('cranes'), 2))
  fauna.setDragon(state.lvl('dragon') > 0)
  fauna.setRabbit(state.lvl('rabbit') > 0, !!state.domains.jade)
  fauna.setKoiGold(state.lvl('goldenkoi') > 0)
  fx.sakuraLevel = state.lvl('sakura') > 0 ? 1 : 0
  fx.rainActive = state.rainOn && state.lvl('rain') > 0
  world.setLanternCount(lanternTarget())
  if (world.anchors.toroLights[0]) toroLight.position.copy(world.anchors.toroLights[0])
  audio.setAmbPad?.(1 + ['dawn', 'jade', 'lotus', 'star'].filter(k => state.domains[k]).length * 0.35)
  world.setCloudSea(state.lvl('cloudsea') > 0)
  cloudSea.setDense(state.lvl('cloudsea') > 0)
  world.setRingsVisible(state.stars > 0)
}
bootLog('🌿 planting the garden…')
try {
  syncWorldToState()
  builder.loadList(state.placements)
} catch (e) {
  console.warn('[boot] world restore failed:', e)
}

bootLog('🪟 preparing interface…')
const ui = new UI(state, {
  onIntro() {
    started = true
    renderOn = true
    bootLog('✨ entering the garden…')
    audio.init()
    audio.resume()
    audio.setMuted(state.muted)
    audio.initAmbience()
    audio.setAmbWind(1)
    audio.setAmbPad(1 + ['dawn', 'jade', 'lotus', 'star'].filter(k => state.domains[k]).length * 0.35)
    audio.setRain(fx.rainActive)
    ui.syncSoundIcon()
    const login = state.checkLogin()
    if (login) {
      setTimeout(() => {
        ui.toast(`📅 Login hari-${login.streak}! +${fmt(login.ess)} ✨${login.fl ? ' · 🌸+1 Bunga' : ''}`, 5000)
        fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 5), 'gold')
        audio.chime(0.12)
      }, 1800)
    }
    if (!state.guide.dismissed && !state.guide.done) ui.showGuide()
    else ui.hideGuide()
    ui.showHint()
    if (offline && offline.gained >= 1) {
      setTimeout(() => ui.toast(`Welcome back · +${fmt(offline.gained)} ✨ gathered while away`), 900)
    }
    setTimeout(() => ui.hideHint(), 22000)
  },
  onBuy(id) {
    if (!state.buy(id)) return
    audio.buy()
    applyUnlock(id, state.lvl(id))
    ui.renderUpgrades()
    state.save()
  },
  onMute(m) {
    state.muted = m
    audio.setMuted(m)
    ui.syncSoundIcon()
    if (m === false) audio.resume()
    state.save()
  },
  onTime() {
    const speeds = [1, 8, 0]
    const labels = ['1×', '8×', '⏸']
    const cur = speeds.indexOf(daynight.speed)
    const next = (cur + 1) % speeds.length
    daynight.speed = speeds[next]
    return labels[next]
  },
  onRain() {
    if (state.lvl('rain') < 1) return
    state.setRain(!state.rainOn)
    fx.rainActive = state.rainOn
    audio.setRain(state.rainOn)
    ui.setRainOn(state.rainOn)
    state.save()
  },
  getCatalog: () => builder.catalog,
  onBuyFlower(id) {
    const def = FLOWER_UPGRADES.find(f => f.id === id)
    const r = state.buyFlowerUpgrade(id)
    if (!r) { ui.toast('🌸 Bunga Abadi belum cukup'); return }
    audio.chime(0.12)
    ui.toast(`🌸 ${r.name} Lv${r.lv} — ${def?.desc || ''}`)
    fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 5), 'gold')
    state.save()
  },
  onClaimDaily(id) {
    const r = state.claimDaily(id)
    if (!r) { ui.toast('⏳ Belum selesai'); return }
    audio.buy()
    setTimeout(() => audio.levelUp(), 500)
    ui.toast(`📅 Tantangan harian! +${fmt(r.ess)} ✨${r.fl ? ' · 🌸 +1 Bunga Abadi' : ''}`, 4200)
    fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 5), 'gold')
    state.save()
  },
  onLeaderboardRefresh() { loadLeaderboard() },
  getStoreCategories: () => builder.categories,
  getStoreItems: () => builder.items,
  getStats() {
    const cats = new Set(state.placements.map(p => String(p.t || '').split('/')[0]).filter(Boolean))
    const owned = Object.keys(state.storeOwned).length
    const domains = ['dawn', 'jade', 'lotus', 'star'].filter(k => state.domains[k]).length
    const c = state.placedCounts()
    return {
      placed: state.placements.length,
      cats: cats.size,
      owned,
      stage: state.domains.main || 1,
      domains,
      forge: state.forgeAssets.length,
      slots: state.slots(),
      pn: c.nature, pl: c.lights, pb: c.buildings, pd: c.decor, pf: c.fauna,
      distinct: state._distinct || 0,
      synS: state._syn?.satwa || 0,
      uniq: (state._uniq || []).map(u => u.name).join(' · '),
      title: state.gardenTitle().name,
      gscore: state.gardenTitle().score
    }
  },
  onBuildSelect(id) {
    if (!id) {
      builder.select(null)
      controls.enableRotate = true
      ui.setSelectedBuild(null)
      ui.hidePlace()
      return
    }
    const res = builder.select(id)
    if (res === false) {
      ui.toast('⚠️ Aset tidak dikenal')
      return
    }
    const name = builder.itemById.get(id)?.name || 'Aset'
    if (res === 'loading') ui.toast(`⏳ Menyiapkan ${name}…`)
    else {
      ui.toast(`🧊 ${name} siap — klik tanah untuk menempatkan`)
      ui.showPlace(name, Math.round((builder.pendingScale ?? 1) * 100))
    }
    controls.enableRotate = false
    ui.setSelectedBuild(id)
  },
  onStoreBuy(id) {
    const it = builder.itemById.get(id)
    if (!it) return
    const hadCopies = state.storeCopies(id) > 0
    if (!state.buyStoreItem(id, it.price)) {
      ui.toast('⚠️ Essence belum cukup')
      return
    }
    state.logEvent(`Beli ${it.name}`, '🛍️')
    markGuide('buy')
    audio.buy()
    ui.toast(hadCopies ? `🛍️ Salinan tambahan ${it.name} dibeli` : `🛍️ ${it.name} dibeli`)
    tipOnce('tempatkan', 'Tekan ＋ pada aset lalu klik tanah. Atur ulang kapan saja lewat 🎛 Kelola.')
    state.save()
    this.onBuildSelect(id)
  },
  onPlaceRotate(dir) { builder.rotate(dir) },
  onPlaceScale(f) { return builder.setPendingScale(f) },
  onPreviewItem(id) { prevShow(id) },
  onPreviewStop() {
    if (storePrev.raf) { cancelAnimationFrame(storePrev.raf); storePrev.raf = 0 }
  },
  onPlaceCancel() {
    builder.select(null)
    controls.enableRotate = true
    ui.setSelectedBuild(null)
    ui.hidePlace()
  },
  onGuideDismiss() {
    state.guide.dismissed = 1
    state.save()
    ui.hideGuide()
  },
  onPhotoShot() {
    try {
      composer.render()
      const url = renderer.domElement.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = 'sakura-sky-garden-' + Date.now() + '.png'
      a.click()
      audio.chime(0.12)
      ui.toast('📸 Foto taman tersimpan!')
    } catch (e) {
      ui.toast('⚠️ Gagal menyimpan foto')
    }
  },
  onDomainBuy(id) {
    const def = state.buyDomain(id)
    if (!def) { ui.toast('⚠️ Belum memenuhi syarat'); return }
    state.logEvent(`${def.icon} ${def.name}`, '🗺️')
    audio.buy()
    setTimeout(() => audio.unlock(), 450)
    if (def.kind === 'expandMain') {
      world.setIslandStage(def.stage, true)
      fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 6), 'celebrate')
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        fx.burst(new THREE.Vector3(Math.cos(a) * (8 + def.stage * 1.6), 11.4, Math.sin(a) * (8 + def.stage * 1.6)), 'poof')
      }
    } else if (def.kind === 'island') {
      syncDomainsToWorld(true)
      tipOnce('kelola', '🎛 Kelola di 🏪 Toko: klik objek untuk menggeser, memutar & memperbesar')
    } else if (def.kind === 'slots') {
      fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 6), 'gold')
      ui.toast(`🧩 Slot Taman +5 — total ${state.slots()}`)
      state.save()
      ui.renderBuild()
      return
    } else {
      syncDomainsToWorld(false)
      fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 6), 'celebrate')
    }
    ui.showBanner(`${def.icon} ${def.name}`, def.kind === 'island' ? 'Pulau baru muncul dari kabut!' : def.desc)
    state.save()
    ui.renderBuild()
  },
  onBuildMode(m) { builder.setMode(m) },
  onObjRotate(dir) {
    builder.rotateSelected(dir)
    state.save()
  },
  onObjScale(f) { builder.scaleSelected(f); state.save() },
  onObjMoveToggle() { builder.toggleMoveSelected() },
  onObjDelete() {
    builder.deleteSelected()
    audio.tap(4)
    state.save()
  },
  onObjUpgrade() {
    const r = builder.upgradeSelected()
    if (!r) return
    if (!r.ok) { ui.toast('⚠️ Essence belum cukup untuk upgrade'); return }
    audio.buy()
    const p = builder.selGroup?.position.clone()
    if (p) fx.spawnSpark(p.setY(p.y + 1), ['#FFE29A', '#BFFFE0', '#FFF'])
    state.save()
  },
  onObjStore() {
    const item = builder.storeSelected()
    audio.chime(0.08)
    ui.toast(`📦 ${item?.name || 'Objek'} disimpan ke storage — salinan bebas dipakai lagi`)
    state.save()
    if (!ui.buildPanel.classList.contains('hidden')) ui.renderBuild()
  },
  onObjSnapCycle() {
    const SNAPS = [1, 0.5, 0.25, 0]
    snapIx = (snapIx + 1) % SNAPS.length
    return builder.setSnapStep(SNAPS[snapIx])
  },
  onObjFreeToggle() { return builder.setFreeMove(!builder.freeMove) },
  onMovePos(p) {
    ui.$('objCoord').textContent = `x ${p.x} · z ${p.z}${p.replacing ? ' · 🔁 timpa' : ''}`
  },
  onReplaced(def) {
    audio.chime(0.08)
    ui.toast(`🔁 ${def?.name || 'Objek'} ditimpa — disimpan ke storage`)
    state.save()
    if (!ui.buildPanel.classList.contains('hidden')) ui.renderBuild()
  },
  onObjClose() { builder.clearSelection() },
  onClaimQuest(id) {
    const r = state.claimQuest(id)
    if (!r) return
    audio.buy()
    ui.toast(`📜 Task complete · +${fmt(r.essence)} ✨ · +${fmt(r.xp)} XP`)
    ui.renderQuests()
  },
  onAscend() {
    const g = state.ascend()
    if (!g) return
    state.logEvent(`✧ Ascension ${state.ascensions} · +${g}⭐`, '✧')
    audio.gong()
    setTimeout(() => audio.levelUp(), 900)
    world.setRingsVisible(true)
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        fx.burst(
          new THREE.Vector3((Math.random() - 0.5) * 10, world.anchors.pagodaTop.y - 6 - Math.random() * 8, (Math.random() - 0.5) * 10),
          'celebrate'
        )
      }, i * 300)
    }
    ui.showBanner(`✧ Ascension ${state.ascensions} ✧`, `+${g}⭐ Immortal Stars · permanent ×${(1 + state.stars * 0.35).toFixed(2)} to all rates`)
    fx.rainActive = false
    audio.setRain(false)
    ui.setRainOn(false)
    ui.setRainVisible(false)
    syncWorldToState()
    ui.renderUpgrades()
    ui.renderBuild()
    ui.renderQuests()
    state.save()
  },
  onReset() {
    state.reset()
    location.reload()
  },
  onRiset() {
    const r = state.risetProgress()
    if (!r) { ui.toast('Progres sudah di awal — tidak ada yang diriset.'); return }
    builder.clearAllPlaced()
    forge.clearAllAssets()
    state.logEvent('🔬 Riset Progres total', '🔬')
    audio.gong()
    setTimeout(() => audio.levelUp(), 700)
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        fx.burst(
          new THREE.Vector3((Math.random() - 0.5) * 12, world.anchors.pagodaTop.y - 5 - Math.random() * 9, (Math.random() - 0.5) * 12),
          'celebrate'
        )
      }, i * 260)
    }
    ui.showBanner('🔬 Riset Progres', `Semua kembali ke nol dari Level ${r.from} · essence & bintang tetap milikmu`)
    ui.toast('🔬 Progres diriset — mulai bangun lagi dari nol!')
    syncWorldToState()
    ui.renderUpgrades()
    ui.renderBuild()
    ui.renderQuests()
    state.save()
  },
  onFullscreen() {
    const doc = document
    if (!doc.fullscreenElement) {
      doc.documentElement.requestFullscreen?.().catch(() => { })
    } else {
      doc.exitFullscreen?.().catch(() => { })
    }
  },
  onExport() {
    const raw = state.exportSave()
    if (!raw) { ui.toast('⚠️ Could not read save'); return }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(raw)
        .then(() => ui.toast('📋 Save copied to clipboard — keep it safe!'))
        .catch(() => { prompt('Copy your save string:', raw) })
    } else {
      prompt('Copy your save string:', raw)
    }
  },
  onImport() {
    const str = prompt('Paste your save string:')
    if (!str) return
    if (state.importSave(str)) {
      ui.toast('💾 Save imported — reloading…')
      setTimeout(() => location.reload(), 700)
    } else {
      ui.toast('⚠️ Invalid save string')
    }
  },
  async onSignIn(email, pass) {
    if (!email || !pass) { ui.setAuthMsg('Isi email dan password.', 'err'); return }
    ui.setAuthMsg('Signing in…')
    const r = await cloud.signIn(email, pass)
    if (r.error) { ui.setAuthMsg(friendlyAuthError(r.error), 'err'); return }
    ui.setAuthMsg('Signed in ✓', 'ok')
  },
  async onSignUp(email, pass) {
    if (!email || !pass) { ui.setAuthMsg('Isi email dan password.', 'err'); return }
    if (pass.length < 6) { ui.setAuthMsg('Password minimal 6 karakter.', 'err'); return }
    ui.setAuthMsg('Creating account…')
    const r = await cloud.signUp(email, pass)
    if (r.error) { ui.setAuthMsg(friendlyAuthError(r.error), 'err'); return }
    if (r.needsConfirm) { ui.setAuthMsg('📧 Cek email untuk konfirmasi akun, lalu Sign in.', 'ok'); return }
    ui.setAuthMsg('Account created ✓', 'ok')
  },
  async onSignOut() {
    await cloud.signOut()
    ui.toggleAuth(false)
  },
  async onSaveName(name) {
    if (!name) { ui.setAuthMsg('Nama tidak boleh kosong.', 'err'); return }
    const updated = await cloud.saveProfile({ display_name: name })
    if (updated) {
      profile = updated
      ui.updateAuthUI({ isGuest: false, email: cloud.email, profile: updated })
      ui.toast('🌱 Nama tersimpan')
    } else {
      ui.setAuthMsg('Gagal menyimpan nama — coba lagi.', 'err')
    }
  }
})

boot.done = true
clearInterval(watchdog)
if (introLoad) {
  introLoad.style.color = ''
  introLoad.textContent = offline && offline.gained >= 1
    ? `☁️ +${fmt(offline.gained)} essence gathered while away`
    : '🌿 garden ready — tap to begin'
}

document.addEventListener('fullscreenchange', () => {
  ui.syncFullscreen(!!document.fullscreenElement)
})

const dock = new DockUI()
dock.register('upgrades', world.anchors.dock_upgrades)
dock.register('build', world.anchors.dock_build)
dock.register('quests', world.anchors.dock_quests)
ui.attachDock(dock, null, camera)

const radial = new RadialMenu(key => {
  if (key === 'upgrades') ui.toggleUpgrades()
  else if (key === 'build') ui.toggleBuild()
  else if (key === 'tasks') ui.toggleQuests()
  else if (key === 'photo') ui.togglePhoto()
  else if (key === 'help') ui.toggleHelp()
})

fauna.onGoldenStart = () => audio.chime(0.1)
world.onLanternReleased = () => audio.chime(0.06)
world.onBridgeRevealed = () => {
  fx.burst(world.anchors.bridgeEnd, 'celebrate')
  ui.toast('⛩️ Pulau Torii muncul dari kabut!')
}
world.onJadeRevealed = () => {
  const p = world.anchors.rabbitJade
  fx.burst(new THREE.Vector3(p.x, p.y + 1.5, p.z), 'celebrate')
  ui.toast('🏯 Jade Terrace terangkat ke langit!')
}
world.onLotusRevealed = () => {
  fx.burst(new THREE.Vector3(-24, 11, 24), 'celebrate')
  ui.toast('🪷 Lotus Haven hadir di antara bebatuan!')
}
world.onStarRevealed = () => {
  fx.burst(new THREE.Vector3(36, 30, -27), 'celebrate')
  ui.toast('🌟 Star Peak mencapai lautan awan!')
}

builder.loadCatalog().then(async () => {
  const types = [...new Set(state.placements.map(p => p.t))]
  await Promise.all(types.map(t => builder.ensureTemplate(t)))
  builder.loadList(state.placements)
  ui.renderBuild()
  prevShow('nature/pohon_sakura')
})

builder.hooks.onSelChange = info => info ? ui.showObj(info) : ui.hideObj()

const storePrev = { r: null, scene: null, cam: null, group: null, id: null, raf: 0 }
function prevInit() {
  if (storePrev.r) return
  const cv = document.getElementById('storePreview')
  if (!cv) return
  storePrev.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true })
  storePrev.r.setSize(150, 150, false)
  storePrev.r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  storePrev.scene = new THREE.Scene()
  storePrev.scene.add(new THREE.HemisphereLight('#EAF2FF', '#5A4A66', 0.95))
  const d = new THREE.DirectionalLight('#FFF2D8', 1.25)
  d.position.set(6, 10, 4)
  storePrev.scene.add(d)
  storePrev.cam = new THREE.PerspectiveCamera(38, 1, 0.1, 900)
}
function prevSpin() {
  storePrev.raf = requestAnimationFrame(prevSpin)
  if (!storePrev.group || !ui || ui.buildPanel.classList.contains('hidden')) {
    cancelAnimationFrame(storePrev.raf)
    storePrev.raf = 0
    return
  }
  storePrev.group.rotation.y += 0.02
  storePrev.r.render(storePrev.scene, storePrev.cam)
}
function prevShow(id) {
  prevInit()
  if (!storePrev.r) return
  if (storePrev.id === id) { if (!storePrev.raf) prevSpin(); return }
  if (!builder.templates.has(id)) {
    builder.ensureTemplate(id).then(ok => { if (ok && builder.templates.has(id)) prevShow(id) })
    return
  }
  while (storePrev.scene.children.length > 2) {
    const c = storePrev.scene.children.pop()
    c.traverse?.(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.() } })
  }
  const tpl = builder.templates.get(id)
  const def = builder.itemById.get(id)
  const g = new THREE.Group()
  if (tpl.solid) g.add(new THREE.Mesh(tpl.solid, new THREE.MeshLambertMaterial({ vertexColors: true })))
  if (tpl.glow) g.add(new THREE.Mesh(tpl.glow, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })))
  const sc = def.scale || 1
  g.scale.setScalar(sc)
  g.position.y = -(def.size[1] * sc) / 2
  storePrev.scene.add(g)
  storePrev.group = g
  storePrev.id = id
  const h = def.size[1] * sc
  const w = Math.max(def.size[0], def.size[2]) * sc
  const dist = Math.max(h, w) * 1.9 + 4
  storePrev.cam.position.set(dist * 0.75, dist * 0.62, dist * 0.75)
  storePrev.cam.lookAt(0, 0, 0)
  if (!storePrev.raf) prevSpin()
}
let lastPX = 0, lastPY = 0
let snapIx = 0
builder.hooks.onTemplateReady = id => {
  if (builder.selected !== id || !builder.active) return
  const name = builder.itemById.get(id)?.name || 'Aset'
  ui.toast(`🧊 ${name} siap — klik tanah untuk menempatkan`)
  ui.showPlace(name, Math.round((builder.pendingScale ?? 1) * 100))
  builder.handlePointer(lastPX, lastPY, camera, raycaster, false)
}
builder.hooks.onExhausted = def => {
  controls.enableRotate = true
  ui.setSelectedBuild(null)
  ui.hidePlace()
  if (def?.name) {
    ui.toast(`📍 ${def.name}: semua salinan terpasang — beli lagi untuk menambah`)
    ui.pulseCounter?.()
  }
}
builder.hooks.onSelectFailed = () => {
  controls.enableRotate = true
  ui.setSelectedBuild(null)
  ui.toast('⚠️ Gagal memuat aset — pilih lagi.')
}

const forge = new VoxelForge({
  scene,
  world,
  onToast: t => ui.toast(t),
  getSaved: () => state.forgeAssets,
  onSave: list => {
    const bytes = a => ((a?.d || '').length * 0.75 + 512)
    let budget = 2500000
    const kept = []
    const arr = Array.isArray(list) ? list : []
    for (let i = arr.length - 1; i >= 0; i--) {
      budget -= bytes(arr[i])
      if (budget < 0) break
      kept.unshift(arr[i])
    }
    if (kept.length !== arr.length) console.warn('[forge] kuota penyimpanan penuh — menyimpan', kept.length, 'karya terbaru')
    state.forgeAssets = kept
    state.save()
  }
})
forge.restore()

function loadLeaderboard() {
  const box = document.getElementById('lbList')
  if (!box) return Promise.resolve()
  box.innerHTML = '<div class="dim">Memuat…</div>'
  return cloud.fetchLeaderboard().then(rows => {
    if (!rows) {
      box.innerHTML = '<div class="dim">Papan peringkat belum aktif.<br>Jalankan bagian <b>Leaderboard</b> di <b>supabase/schema.sql</b> pada SQL Editor Supabase, lalu muat ulang.</div>'
      return
    }
    if (!rows.length) { box.innerHTML = '<div class="dim">Belum ada pemain terdaftar.</div>'; ui.setRank?.(null); return }
    box.innerHTML = rows.map((r, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || (i + 1)
      const nm = String(r.display_name || 'Gardener').slice(0, 20)
      const me = r.id === cloud.uid ? ' · <b>kamu</b>' : ''
      return `<div class="h-row"><time>${medal}</time><span><b>${nm}</b>${me} — Lv${r.garden_level ?? 1} · 🌾${r.best_stage ?? 1} · 🔨 ${r.total_placed ?? 0}</span></div>`
    }).join('')
    const myIx = rows.findIndex(r => r.id === cloud.uid)
    ui.setRank?.(myIx >= 0 ? myIx + 1 : null)
  })
}

function tipOnce(key, msg) {
  if (state.tips[key]) return
  state.tips[key] = 1
  state.save()
  ui.toast(msg, 4600)
}

function markGuide(k) {
  if (state.guide[k] || state.guide.done) return
  state.guide[k] = 1
  const keys = ['e100', 'buy', 'place', 'manage']
  if (keys.every(x => state.guide[x])) {
    state.guide.done = 1
    audio.chime(0.14)
    setTimeout(() => audio.levelUp(), 500)
    fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 5), 'celebrate')
    ui.toast('🎓 Panduan selesai — taman ini milikmu!')
    state.logEvent('🎓 Panduan pemula selesai', '🎓')
    setTimeout(() => ui.hideGuide(), 1600)
  }
  state.save()
  ui.updateGuide()
}

connectCloudSave()

document.addEventListener('pointerdown', e => {
  if (radial.isOpen && !e.target.closest?.('#radial')) radial.close()
}, true)

function applyUnlock(id, lvl) {
  switch (id) {
    case 'koi': fauna.setKoi(Math.min(lvl, 8)); break
    case 'butterflies': fauna.setButterflies(Math.min(lvl, 12)); break
    case 'spirits': fauna.setWisps(Math.min(10, Math.ceil(lvl / 2))); break
    case 'fox': fauna.setFox(true, !!state.domains.dawn); break
    case 'phoenix': fauna.setPhoenix(true); break
    case 'sakura':
      fx.sakuraLevel = 1
      ui.toast('🌸 Sakura Breeze — petals drift across the garden')
      break
    case 'rain':
      ui.setRainVisible(true)
      ui.toast('🌧️ Monsoon Blessing — toggle rain anytime')
      break
    case 'lanterns':
      world.setLanternCount(lanternTarget())
      break
    case 'cranes':
      fauna.setCranes(Math.min(lvl, 2))
      ui.toast('🕊️ Immortal cranes glide between the isles')
      break
    case 'goldenkoi':
      fauna.setKoiGold(true)
      ui.toast('🐠 Golden Koi Blessing — the pond shimmers')
      break
    case 'cloudsea':
      world.setCloudSea(true)
      ui.toast('☁️ The cloud sea thickens beneath the garden')
      break
    case 'rabbit':
      fauna.setRabbit(true, !!state.domains.jade)
      ui.toast(state.domains.jade ? '🐇 The Moon Rabbit pounds the elixir' : '🐇 The Moon Rabbit rests in the garden')
      break
    case 'dragon':
      fauna.setDragon(true)
      ui.toast('🐉 The Azure Celestial Dragon dances among the clouds!')
      audio.dragonCall()
      setTimeout(() => audio.dragonCall(), 2200)
      break
  }
  if (['fox', 'phoenix', 'dragon', 'cloudsea'].includes(id)) {
    fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 4), 'celebrate')
    audio.unlock()
  }
}

state.on('synergy', ({ ids }) => {
  const NAMES = {
    sakura_gate: '⛩️🌸 Gerbang Sakura (+4% tap)',
    gold_light: '🌟 Gerbang Cahaya (+3% pasif)',
    butterfly_bridge: '🦋 Jembatan Kupu (+2% XP)',
    farm_house: '🏡 Rumah Petani (+1.5/s)',
    forest_fort: '🏰 Benteng Hutan (+4% pasif)'
  }
  for (const id of ids) ui.toast(`⚡ Sinergi terbuka: ${NAMES[id] || id}`, 5000)
  state.logEvent(`⚡ ${ids.length} sinergi unik aktif`, '⚡')
})

state.on('gardentitle', ({ name, score }) => {
  audio.unlock()
  setTimeout(() => audio.levelUp(), 400)
  ui.showBanner(`🏅 ${name}`, `Skor keindahan ${score} · +3% semua rate per gelar`)
  state.logEvent(`🏅 Gelar: ${name} (skor ${score})`, '🏅')
})

state.on('levelup', ({ lvl, reward }) => {  audio.levelUp()
  ui.pulseCounter()
  const unlockLabel = LEVEL_UNLOCKS[lvl] || 'New blessings await'
  ui.showBanner(`🌱 Garden Level ${lvl}`, `${unlockLabel} · +${fmt(reward)} ✨`)
  fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 4), 'celebrate')
  fx.burst(new THREE.Vector3(0, 12, 0), 'gold')
  ui.renderUpgrades()
  ui.renderBuild()
})

state.on('achievement', ({ a, reward }) => {
  audio.unlock()
  ui.showBanner(`🏆 ${a.name}`, `${a.desc} · +${fmt(reward)} ✨`)
  ui.pulseCounter()
  ui.renderQuests()
})

if (state.lvl('rain') > 0) ui.setRainVisible(true)
ui.setRainOn(fx.rainActive)

function buildInputActive() { return builder.active || ui.removing || ui.managing }

window.addEventListener('keydown', e => {
  const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
  if (e.key === 'Escape') {
    if (typing) { e.target.blur?.(); return }
    if (radial.isOpen) radial.close()
    else if (document.body.classList.contains('photo-mode')) document.body.classList.remove('photo-mode')
    else if (buildInputActive()) ui.closeBuild()
  } else if (typing) {
    return
  } else if (e.code === 'KeyR') {
    if (builder.selGroup && builder.managing) builder.rotateSelected(1)
    else if (builder.active) builder.rotate()
  } else if (e.code === 'KeyF' && !e.repeat && e.target === document.body) {
    const doc = document
    if (!doc.fullscreenElement) doc.documentElement.requestFullscreen?.().catch(() => { })
    else doc.exitFullscreen?.().catch(() => { })
  }
})

state.on('questdone', () => {
  audio.chime(0.12)
  ui.renderQuests()
})

const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const hitPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -7)

function collectHitTargets() {
  const list = []
  const grab = vg => vg && vg.group.children.forEach(m => list.push(m))
  grab(world.islandVg)
  grab(world.pagodaVg)
  if (world.isleRevealed) grab(world.isleVg)
  if (world.jadeRevealed && world.jadeVg) grab(world.jadeVg)
  if (world.peachGroup) list.push(...world.peachMeshes.filter(m => m.visible))
  if (world.dockMeshes) list.push(...world.dockMeshes)
  for (const L of world.lanterns) {
    if (L.g.visible && !L.busy) list.push(...L.g.children)
  }
  if (fauna.goldenG.visible) list.push(...fauna.goldenG.children)
  if (fauna.fox.visible) list.push(...fauna.fox.children)
  for (const k of fauna.koi) {
    if (k.g.visible) list.push(...k.g.children)
  }
  if (wishStar.g.visible && wishStar.state === 'landed') list.push(...wishStar.g.children)
  if (spiritReq.active && spiritReq.g && spiritReq.g.visible) list.push(...spiritReq.g.children)
  list.push(world.water)
  return list
}

const wishStar = { g: null, state: 'idle', timer: 40, landedT: 0, trailT: 0 }
let meteorQueue = 0
let wasNight = false
{
  const g = new THREE.Group()
  const star = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFF0B8').multiplyScalar(1.35), toneMapped: false })
  )
  const halo = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFF6D8').multiplyScalar(0.9), toneMapped: false, transparent: true, opacity: 0.4 })
  )
  g.add(star, halo)
  g.traverse(o => { if (o.isMesh) o.userData.special = 'wish' })
  g.visible = false
  scene.add(g)
  wishStar.g = g
}

function startWishStar() {
  const keys = [...world.surfMain.keys()]
  if (!keys.length) { wishStar.timer = 30; return }
  const k = keys[(Math.random() * keys.length) | 0]
  const [sx, sz] = k.split(',').map(Number)
  const ty = world.surfMain.get(k)
  wishStar.g.position.set(sx, ty + 30, sz)
  wishStar.g.visible = true
  wishStar.state = 'falling'
  audio.chime(0.08)
  gsap.to(wishStar.g.position, {
    y: ty + 0.75, duration: 1.5, ease: 'power2.in',
    onComplete: () => {
      wishStar.state = 'landed'
      wishStar.landedT = 12
      fx.burst(wishStar.g.position.clone(), 'celebrate')
    }
  })
}

function collectWish(screenX, screenY) {
  const amt = Math.max(state.passive * 50, state.tapValue * 100, 300)
  state.essence += amt
  state.totalEarned += amt
  state.allTime += amt
  state.runEarned += amt
  state.questEvent('collect', amt)
  state.addXp(10)
  fx.burst(wishStar.g.position.clone(), 'celebrate')
  fx.spawnDebris(wishStar.g.position, '#FFF0B8', 8)
  audio.unlock()
  ui.floater(screenX, screenY, '🌠 +' + fmt(amt), 'gold')
  ui.toast('🌠 Wish granted by the falling star!')
  wishStar.g.visible = false
  wishStar.state = 'idle'
  wishStar.timer = 50 + Math.random() * 40
}

let lastFeedKoi = 0
const KOI_CD = 18000
function feedKoi(idx, screenX, screenY) {
  const now = Date.now()
  if (now - lastFeedKoi < KOI_CD) {
    ui.toast('🐟 Koi masih kenyang — kembali lagi nanti')
    return true
  }
  const k = fauna.koi[idx]
  if (!k || !k.g.visible) return false
  lastFeedKoi = now

  const amt0 = Math.max(state.passive * 4, state.tapValue * 10, 80)
  const golden = Math.random() < (state.hasFlowerUpg('koicharm') ? 0.25 : 0.1)
  const amt = golden ? amt0 * 4 : amt0
  state.essence += amt
  state.totalEarned += amt
  state.allTime += amt
  state.runEarned += amt
  state.counters.collected += amt
  state.questEvent('collect', amt)
  state.addXp(8)
  state.save()

  const p = k.g.position.clone()
  fx.burst(p, 'tap')
  if (golden) {
    fx.spawnSpark(p, ['#FFD76E', '#FFF0B8', '#FF9D5C'])
    ui.floater(screenX, screenY, '✨ KOI EMAS!', 'gold')
    audio.chime(0.1)
  }
  fx.spawnSpark(p, ['#9FD8FF', '#CFEFFF', '#FFFFFF'])
  audio.pluck(523.25, 0.05)
  setTimeout(() => audio.pluck(659.25, 0.04), 90)
  ui.floater(screenX, screenY, '🐟 +' + fmt(amt), 'gold')
  return true
}

let lastPetFox = 0
function petFox(screenX, screenY) {
  const now = Date.now()
  if (now - lastPetFox < 15000) {
    ui.toast('🦊 The fox is purring contentedly…')
    return
  }
  lastPetFox = now
  const amt = Math.max(state.passive * 8, state.tapValue * 20, 40)
  state.essence += amt
  state.totalEarned += amt
  state.allTime += amt
  state.runEarned += amt
  fauna.foxHop()
  const p = fauna.fox.position.clone().setY(fauna.fox.position.y + 1)
  fx.burst(p, 'tap')
  audio.pluck(392, 0.05)
  setTimeout(() => audio.pluck(523.25, 0.04), 110)
  ui.floater(screenX, screenY, '💗 +' + fmt(amt), 'pink')
}

const goldenTrailT = { v: 0 }

function rewardGolden(screenX, screenY) {
  const amt = Math.max(state.passive * 90, state.tapValue * 150, 400)
  state.essence += amt
  state.totalEarned += amt
  state.allTime += amt
  state.runEarned += amt
  state.questEvent('collect', amt)
  state.addXp(20)
  const p = fauna.goldenG.position.clone()
  fx.spawnDebris(p, '#FFD27A', 10)
  fx.burst(p, 'celebrate')
  fx.burst(p.clone().setY(p.y + 1), 'gold')
  audio.unlock()
  ui.floater(screenX, screenY, '🍀 +' + fmt(amt), 'gold')
  ui.toast('🍀 The Golden Butterfly King blesses your garden!')
  ui.pulseCounter()
  fauna.hideGolden()
}

function releaseLantern(idx, screenX, screenY) {
  const L = world.lanterns[idx]
  if (!world.releaseLantern(idx)) return
  const amt = Math.max(state.passive * 12, state.tapValue * 25, 60)
  state.essence += amt
  state.totalEarned += amt
  state.allTime += amt
  state.runEarned += amt
  state.questEvent('collect', amt)
  fx.burst(L.g.position.clone(), 'gold')
  audio.chime(0.1)
  ui.floater(screenX, screenY, '+' + fmt(amt), 'gold')
}
let hitTargets = collectHitTargets()

const peachRespawn = [0, 0, 0, 0, 0]
let lastIncenseAt = 0
const INCENSE_COOLDOWN = 120000

function harvestPeach(idx, screenX, screenY) {
  world.setPeachVisible(idx, false)
  peachRespawn[idx] = 75 + Math.random() * 60
  const amt = Math.max(state.tapValue * 60, state.passive * 45, 150)
  state.essence += amt
  state.totalEarned += amt
  state.allTime += amt
  state.runEarned += amt
  state.questEvent('harvests')
  const pos = world.peachMeshes[idx].position
  fx.spawnDebris(pos, '#FF9E7A', 12)
  fx.burst(pos.clone(), 'gold')
  fx.burst(pos.clone().setY(pos.y + 0.5), 'poof')
  audio.chime(0.12)
  audio.buy()
  ui.floater(screenX, screenY, '+' + fmt(amt), 'gold')
}

function tryIncense(screenX, screenY) {
  if (state.lvl('incense') < 1) return false
  const now = Date.now()
  if (now - lastIncenseAt < INCENSE_COOLDOWN || state.buffActive()) {
    ui.toast('🔥 The incense is still burning…')
    return true
  }
  lastIncenseAt = now
  state.activateBuff(60000)
  audio.gong()
  fx.setIncense(world.anchors.incense)
  ui.toast('🔥 Incense lit · ×2 essence for 60 seconds')
  ui.floater(screenX, screenY, '×2 🔥', 'gold')
  return true
}

let downX = 0, downY = 0, downT = 0, isDown = false, moved = false
let lpTimer = null
let lpFired = false
canvas.addEventListener('pointerdown', e => {
  isDown = true
  moved = false
  lpFired = false
  downX = e.clientX; downY = e.clientY; downT = performance.now()
  lastInteract = performance.now()
  if (radial.isOpen) { radial.close(); return }
  clearTimeout(lpTimer)
  lpTimer = setTimeout(() => {
    if (moved || builder.active || ui.removing) return
    ndc.set((downX / window.innerWidth) * 2 - 1, -(downY / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObjects(builder.placedRoot.children, true)
    lpFired = true
    if (hits.length) {
      let o = hits[0].object
      while (o.parent && o.parent !== builder.placedRoot) o = o.parent
      enterManageFor(o)
    } else {
      radial.open(downX, downY)
    }
  }, 380)
})

function enterManageFor(objGroup) {
  if (!ui.managing) {
    ui.btnManageMode.classList.add('on')
    ui.btnManageMode.textContent = '🎛 Kelola Objek: ON'
    ui.btnDeleteMode.classList.remove('on')
    ui.btnDeleteMode.textContent = '🗑 Hapus: OFF'
    builder.setMode('manage')
  }
  controls.enableRotate = true
  builder.selectPlaced(objGroup)
  audio.tap(3)
  markGuide('manage')
}
canvas.addEventListener('pointermove', e => {
  lastPX = e.clientX
  lastPY = e.clientY
  if ((builder.active && builder.mode === 'place') || builder.managing) {
    builder.handlePointer(e.clientX, e.clientY, camera, raycaster, false)
  }
  if (!isDown) return
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10) {
    moved = true
    clearTimeout(lpTimer)
  }
})
canvas.addEventListener('pointerup', e => {
  isDown = false
  lastInteract = performance.now()
  clearTimeout(lpTimer)
  if (lpFired) { lpFired = false; return }
  if (moved) return
  if (performance.now() - downT > 450) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (buildInputActive()) {
    builder.handlePointer(e.clientX, e.clientY, camera, raycaster, true)
    if (!buildInputActive()) controls.enableRotate = true
    return
  }
  if (ui.anyPanelOpen()) {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const dockHits = raycaster.intersectObjects(world.dockMeshes || [], false)
    if (!dockHits.length) {
      ui.closeEverything()
      return
    }
  }
  handleTap(e.clientX, e.clientY)
})
canvas.addEventListener('contextmenu', e => {
  e.preventDefault()
  if (!moved) radial.open(e.clientX, e.clientY)
})
canvas.addEventListener('wheel', () => { lastInteract = performance.now() }, { passive: true })

let comboCount = 0
let lastTapAt = 0
let tapCountForHint = 0

function handleTap(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  hitTargets = collectHitTargets()
  const hits = raycaster.intersectObjects(hitTargets, false)

  if (hits.length) {
    const obj = hits[0].object
    if (obj.userData?.special === 'dock') {
      const k = obj.userData.dockKey
      if (k === 'upgrades') ui.toggleUpgrades()
      else if (k === 'build') ui.toggleBuild()
      else if (k === 'quests') ui.toggleQuests()
      audio.chime(0.09)
      return
    }
    if (obj.userData?.special === 'golden') {
      rewardGolden(x, y)
      return
    }
    if (obj.userData?.special === 'lantern') {
      releaseLantern(obj.userData.idx, x, y)
      return
    }
    if (obj.userData?.special === 'fox') {
      petFox(x, y)
      return
    }
    if (obj.userData?.special === 'koi') {
      feedKoi(obj.userData.koiIdx, x, y)
      return
    }
    if (obj.userData?.special === 'spirit') {
      tryClaimSpirit(x, y)
      return
    }
    if (obj.userData?.special === 'wish') {
      collectWish(x, y)
      return
    }
    if (obj.userData?.special === 'peach') {
      harvestPeach(obj.userData.idx, x, y)
      return
    }
    if (world.anchors.incense && hits[0].point.distanceTo(world.anchors.incense) < 1.5) {
      if (tryIncense(x, y)) return
    }
  }

  let point
  if (hits.length) point = hits[0].point.clone()
  else {
    point = new THREE.Vector3()
    raycaster.ray.intersectPlane(hitPlane, point)
    if (!point) return
    const d = Math.hypot(point.x, point.z)
    if (d > 24) point.multiplyScalar(24 / d)
  }

  const now = performance.now()
  comboCount = now - lastTapAt < 850 ? comboCount + 1 : 1
  lastTapAt = now
  const mult = Math.min(1 + (comboCount - 1) * 0.08, 3)

  const amt0 = state.addTap(mult)
  let amt = amt0
  if (bloom.active) {
    const bonus = state.tapValue * mult * (state.buffActive() ? 2 : 1)
    state.essence += bonus
    state.totalEarned += bonus
    state.allTime += bonus
    state.runEarned += bonus
    amt += bonus
  }
  if (state.totalEarned >= 100) markGuide('e100')
  if (state.taps >= 12) tipOnce('toko', '🛒 Kumpulkan ✨ essence, lalu buka 🏪 Toko untuk aset pertamamu!')
  if (state.gLevel >= 2) tipOnce('luas', '🌾 Level 2! Perluas pulau & beli domain baru lewat 🏪 Toko')
  fx.burst(point, 'tap')
  const ripY = hits.length ? point.y + 0.08 : 10.55
  fx.ripple(new THREE.Vector3(point.x, ripY, point.z))
  audio.tap(comboCount)
  ui.floater(x, y, '+' + fmt(amt), mult > 1.4 ? 'gold' : 'pink')
  ui.showCombo(mult)

  tapCountForHint++
  if (tapCountForHint === 10) ui.hideHint()
}

function applyResize() {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  composer.setSize(w, h)
}

window.addEventListener('resize', applyResize)
if (window.visualViewport) {
  visualViewport.addEventListener('resize', () => setTimeout(applyResize, 60))
}
document.addEventListener('fullscreenchange', () => setTimeout(applyResize, 80))

document.addEventListener('touchmove', e => {
  if (e.target === canvas) e.preventDefault()
}, { passive: false })

window.addEventListener('beforeunload', () => {
  if (started) {
    state.save()
    pushCloud()
  }
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden && started) {
    state.save()
    pushCloud()
  } else audio.resume()
})

const clock = new THREE.Clock()
const NIGHT_TINT = new THREE.Color(0.62, 0.7, 0.88)
let uiAcc = 0
let saveAcc = 0
let achAcc = 0
let cloudAcc = 0
let ambAcc = 0
let nfAcc = 0
let lastCloudStr = ''

const quality = { lvl: 1, low: 0, high: 0, last: 0 }
function applyQuality(l) {
  quality.lvl = l
  if (l === 2) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    bloom.enabled = true
    sunLight.shadow.mapSize.set(2048, 2048)
    if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null }
  } else if (l === 1) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2))
    bloom.enabled = false
    sunLight.shadow.mapSize.set(1024, 1024)
    if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null }
  } else {
    renderer.setPixelRatio(1)
    bloom.enabled = false
    sunLight.castShadow = false
    renderer.shadowMap.enabled = false
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true })
  }
  applyResize()
}
applyQuality(1)

let fpsLast = performance.now()
let fpsFrames = 0
let lastQChange = performance.now()

const OUTBOX_KEY = 'ssg-outbox-v1'
function readOutbox() {
  try {
    const d = JSON.parse(localStorage.getItem(OUTBOX_KEY))
    return d && typeof d === 'object' && isValidRemoteSave(d.obj) ? d : null
  } catch { return null }
}
function writeOutbox(uid, obj) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify({ uid, savedAt: Date.now(), obj })) } catch (e) { }
}
function clearOutbox() {
  try { localStorage.removeItem(OUTBOX_KEY) } catch (e) { }
}
async function flushOutbox() {
  if (!cloud.ok || syncingAccount) return
  const pending = readOutbox()
  if (!pending || pending.uid !== cloud.uid) return
  const ok = await Promise.race([cloud.push(pending.obj), sleep(5000).then(() => false)])
  if (ok) clearOutbox()
}

async function pushCloud() {
  if (!cloud.ok || !started || syncingAccount) return
  await flushOutbox()
  const obj = state.serialize()
  const str = JSON.stringify(obj)
  if (str !== lastCloudStr) {
    lastCloudStr = str
    const okPush = await Promise.race([cloud.push(obj), sleep(6000).then(() => false)])
    if (okPush) {
      clearOutbox()
      cloud.pushStats({
        garden_level: state.gLevel,
        best_stage: Math.max(state.domains.main || 1, ...['dawn', 'jade', 'lotus', 'star'].filter(k => state.domains[k]).map(() => 2), 1),
        total_placed: state.placements.length
      }).catch?.(() => { })
    } else if (cloud.uid) writeOutbox(cloud.uid, obj)
    ui.setCloudState(okPush ? 'on' : 'err')
  } else {
    ui.setCloudState(readOutbox() ? 'err' : 'on')
  }
}

let animError = false
let renderOn = false
function animate() {
  requestAnimationFrame(animate)
  if (animError || !renderOn) return
  try {
    runFrame()
  } catch (e) {
    animError = true
    console.error(e)
    bootLog('⚠️ ' + (e.message || 'render error'))
  }
}

let sakuraBloom = { active: false, timer: 150, left: 0 }
const spiritReq = { g: null, active: false, cat: null, isKoi: false, label: '', timer: 0, nextSpawn: 100 }

function spawnSpirit() {
  const cats = ['nature', 'lights', 'buildings', 'decor']
  const avail = []
  for (const c of cats) {
    if (state.placements.some(p => String(p.t || '').split('/')[0] === c)) {
      avail.push({ cat: c, isKoi: false })
    }
  }
  if (state.lvl('koi') > 0) avail.push({ cat: null, isKoi: true })

  if (!avail.length) { spiritReq.nextSpawn = 60; return }
  const pick = avail[Math.floor(Math.random() * avail.length)]

  if (!spiritReq.g) {
    const g = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#D8B4FE', transparent: true, opacity: 0.85, toneMapped: false })
    )
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.08, 8, 24),
      new THREE.MeshBasicMaterial({ color: '#C084FC', transparent: true, opacity: 0.5, toneMapped: false })
    )
    ring.rotation.x = Math.PI / 2
    g.add(core, ring)
    g.traverse(o => {
      if (o.isMesh) o.userData.special = 'spirit'
    })
    g.userData.special = 'spirit'
    spiritReq.g = g
    scene.add(g)
  }

  const a = Math.random() * Math.PI * 2
  const rr = 3 + Math.random() * 4
  spiritReq.g.position.set(Math.cos(a) * rr, 17 + Math.random() * 3, Math.sin(a) * rr)
  spiritReq.g.visible = true
  spiritReq.active = true
  spiritReq.cat = pick.cat
  spiritReq.isKoi = pick.isKoi

  const ICONS = { nature: '🌳', lights: '✨', buildings: '🏯', decor: '🏮' }
  spiritReq.label = pick.isKoi ? 'ingin bermain dengan 🐟 koi' : `ingin melihat ${ICONS[spiritReq.cat]} ${spiritReq.cat}`
  ui.toast(`👻 Roh muncul — ${spiritReq.label}! Sentuh bola ungu jika syarat terpenuhi`, 4500)
  audio.chime(0.1)
}

function despawnSpirit(fulfilled) {
  if (!spiritReq.g) return
  spiritReq.g.visible = false
  spiritReq.active = false
  spiritReq.nextSpawn = fulfilled ? 120 + Math.random() * 80 : 50 + Math.random() * 30
}

function tryClaimSpirit(screenX, screenY) {
  let ok = false
  let label = ''
  if (spiritReq.isKoi) {
    ok = state.lvl('koi') > 0
    label = '🐟 koi'
  } else {
    label = spiritReq.cat || '?'
    ok = state.placements.some(p => String(p.t || '').split('/')[0] === spiritReq.cat)
  }
  if (!ok) {
    ui.toast(`👻 Roh masih menunggu ${spiritReq.label}…`)
    return true
  }
  const amt = Math.max(state.passive * 15, state.tapValue * 25, 300)
  state.essence += amt
  state.totalEarned += amt
  state.allTime += amt
  state.runEarned += amt
  state.counters.collected += amt
  state.questEvent('collect', amt)
  state.addXp(20)

  let extraFl = ''
  if (Math.random() < 0.2) {
    state.flowers++
    extraFl = ' · 🌸+1 Bunga'
    audio.chime(0.14)
  }
  state.logEvent('👻 Permintaan roh dipenuhi', '👻')
  state.save()

  fx.burst(spiritReq.g.position.clone(), 'celebrate')
  audio.chime(0.12)
  setTimeout(() => audio.levelUp(), 350)
  ui.floater(screenX, screenY, '👻 +' + fmt(amt), 'gold')
  ui.toast(`👻 Permintaan terpenuhi! +${fmt(amt)} ✨${extraFl}`, 4200)
  despawnSpirit(true)
  return true
}

function runFrame() {
  const dt = Math.min(clock.getDelta(), 0.05)
  const tGlob = clock.elapsedTime

  state.tick(dt)
  const env = daynight.update(dt, tGlob)

  const evB = state._evBoost || 0
  if (started) {
    // spirit orb
    if (!spiritReq.active) {
      spiritReq.nextSpawn -= dt
      if (spiritReq.nextSpawn <= 0 && state.placements.length > 0) spawnSpirit()
    } else {
      spiritReq.timer += dt
      if (spiritReq.g) {
        spiritReq.g.position.y = 17 + Math.sin(tGlob * 1.5) * 1.2
        spiritReq.g.rotation.y = tGlob * 0.6
      }
      if (spiritReq.timer > 45) despawnSpirit(false)
    }

    const weekend = [0, 6].includes(new Date().getDay())
    const faunaBoost = 1 + Math.min((state.placedCounts().fauna || 0), 20) * 0.05
      + Math.min((state._syn?.satwa || 0), 15) * 0.04
    if (!sakuraBloom.active) {
      sakuraBloom.timer -= dt * faunaBoost * (1 + evB * 0.5)
      if (sakuraBloom.timer <= 0) {
        sakuraBloom.active = true
        sakuraBloom.left = (weekend ? 60 : 40) + evB * 5 + Math.min((state.placedCounts().fauna || 0), 20) * 1.5
        fx.sakuraLevel = Math.max(fx.sakuraLevel, 1)
        audio.chime(0.12)
        ui.toast(weekend ? '🎉 Weekend Bloom! Tap ×2 selama 60 detik' : '🌸 Sakura Bloom! Tap ×2 selama 40 detik', 4200)
        fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 5), 'gold')
      }
    } else {
      sakuraBloom.left -= dt
      if (sakuraBloom.left <= 0) {
        sakuraBloom.active = false
        sakuraBloom.timer = weekend ? 240 + Math.random() * 100 : 380 + Math.random() * 160
        syncWorldToState()
        ui.toast('🌸 Sakura Bloom berakhir — sampai jumpa lagi!')
      }
    }
  }

  const U = voxelUniforms
  U.uTime.value = tGlob
  U.uSunDir.value.copy(sunLight.position).normalize()
  U.uSunColor.value.copy(sunLight.color).multiplyScalar(sunLight.intensity)
  U.uNight.value = env.nf
  U.uTint.value.setRGB(1, 1, 1).lerp(NIGHT_TINT, env.nf * 0.55)

  world.update(dt, tGlob)
  cloudSea.update(dt)
  cloudSea.setNight(env.nf)
  fx.waterfallOn = !!world.waterfallOn
  ambAcc += dt
  if (ambAcc > 0.35) { ambAcc = 0; audio.setAmbNight(env.nf) }
  nfAcc += dt
  if (nfAcc > 0.4) { nfAcc = 0; fauna.setNightFactor(env.nf) }
  fauna.update(dt)
  fx.update(dt, tGlob, env)
  dock.update()

  fx.setIncense(state.buffActive() ? world.anchors.incense : null)
  // badge bob animation
  for (const g of builder.placedGroups.values()) {
    for (const child of g.children) {
      if (child.userData?.isBadge) {
        if (child.userData.baseY === undefined) child.userData.baseY = child.position.y
        child.position.y = child.userData.baseY + Math.sin(tGlob * 2 + g.position.x) * 0.12
      }
    }
  }
  if (fauna.goldenG.visible) {
    goldenTrailT.v -= dt
    if (goldenTrailT.v <= 0) {
      goldenTrailT.v = 0.14
      fx.spawnSpark(fauna.goldenG.position, ['#FFE29A', '#FFF6D8', '#FFD27A'])
    }
  }
  if (started && wishStar.state === 'idle') {
    const isNight = env.nf > 0.6
    if (isNight && !wasNight) meteorQueue = Math.min(2, meteorQueue + 2)
    wasNight = isNight
    wishStar.timer -= dt * (meteorQueue > 0 ? 4 : 1) * (1 + Math.min((state.placedCounts().fauna || 0), 20) * 0.04) * (1 + evB * 0.25)
    if (wishStar.timer <= 0) {
      if (env.nf > 0.55) {
        startWishStar()
        if (meteorQueue > 0) meteorQueue--
      } else wishStar.timer = 15
    }
  } else if (wishStar.state === 'falling') {
    wishStar.trailT -= dt
    if (wishStar.trailT <= 0) {
      wishStar.trailT = 0.05
      fx.spawnSpark(wishStar.g.position, ['#FFF0B8', '#FFFFFF'])
    }
  } else if (wishStar.state === 'landed') {
    wishStar.landedT -= dt
    wishStar.g.rotation.y += dt * 2
    const pulse = 1 + Math.sin(tGlob * 5) * 0.12
    wishStar.g.scale.setScalar(pulse)
    if (wishStar.landedT <= 0) {
      wishStar.g.visible = false
      wishStar.state = 'idle'
      wishStar.timer = 50 + Math.random() * 40
    }
  }
  for (let i = 0; i < peachRespawn.length; i++) {
    if (peachRespawn[i] > 0) {
      peachRespawn[i] -= dt
      if (peachRespawn[i] <= 0) world.setPeachVisible(i, true)
    }
  }

  controls.autoRotate = performance.now() - lastInteract > 10000
  controls.update()
  const lim = Math.max(14, (world.R || 15) * 0.95)
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -lim, lim)
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -lim, lim)
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 2, 14)
  controls.maxDistance = 30 + (world.R || 15) * 2.4

  composer.render()

  uiAcc += dt
  if (uiAcc > 0.2) { ui.refresh(); uiAcc = 0 }
  achAcc += dt
  if (achAcc > 2) { state.checkAchievements(); achAcc = 0 }
  saveAcc += dt
  if (saveAcc > 5 && started) { state.save(); ui.flashSaved(); saveAcc = 0 }
  cloudAcc += dt
  if (cloudAcc > 20) { pushCloud(); cloudAcc = 0 }

  fpsFrames++
  const nowMs = performance.now()
  if (nowMs - fpsLast >= 1000) {
    const fps = Math.round(fpsFrames * 1000 / (nowMs - fpsLast))
    fpsFrames = 0
    fpsLast = nowMs
    if (fps < 25) { quality.low++; quality.high = 0 }
    else if (fps > 52) { quality.high++; quality.low = 0 }
    else { quality.low = 0; quality.high = 0 }
    if (quality.low >= 2 && quality.lvl > 0 && nowMs - lastQChange > 3000) {
      applyQuality(quality.lvl - 1)
      lastQChange = nowMs
      quality.low = 0
    } else if (quality.high >= 5 && quality.lvl < 2 && nowMs - lastQChange > 8000) {
      applyQuality(quality.lvl + 1)
      lastQChange = nowMs
      quality.high = 0
    }
  }
}

animate()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller && started) {
            ui.toast('🔄 Versi baru tersedia — muat ulang halaman untuk memperbarui', 6000)
          }
        })
      })
    }).catch(e => console.warn('[pwa] sw gagal:', e))
  })
}

window.addEventListener('online', () => { pushCloud() })
