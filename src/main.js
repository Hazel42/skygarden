import * as THREE from 'three'
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
import { GameState, LEVEL_UNLOCKS, fmt } from './state.js'
import { Builder } from './build.js'
import { UI } from './ui.js'
import { audio } from './audio.js'
import { createCloudSea } from './cloudsea.js'
import { DockUI } from './dockui.js'
import { RadialMenu } from './radial.js'
import { cloud } from './cloud.js'

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
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
const world = new World(sys, scene)
const cloudSea = createCloudSea(scene)
const fx = new FX(scene, world.anchors)
const fauna = new Fauna(scene, world.anchors)
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

const builder = new Builder(scene, world, state, {
  onPlaced(item, pos) {
    audio.buy()
    fx.burst(pos.clone().setY(pos.y + 1.2), 'poof')
    state.questEvent('placed')
    state.save()
  },
  onRemoved(item, pos) {
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
toroLight.position.copy(world.anchors.toroLights[0])
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
let remoteSave = null
try {
  const ok = await Promise.race([cloudReady, sleep(2600).then(() => false)])
  if (ok) remoteSave = await Promise.race([cloud.pull(), sleep(2500).then(() => null)])
} catch (e) { }
const localRaw = state.readLocalRaw()
if (remoteSave && (!localRaw || (remoteSave.last || 0) > (localRaw.last || 0))) {
  state.adoptRemote(remoteSave)
}
setCloudIndicator(cloud.ok ? 'on' : '')
const offline = state.load()
if (offline && offline.gained >= 1) {
  setTimeout(() => {
    const el = document.getElementById('introLoad')
    if (el) el.textContent = `☁️ +${fmt(offline.gained)} essence gathered while away`
  }, 100)
}
const introLoad = document.getElementById('introLoad')
if (introLoad) introLoad.textContent = cloud.ok ? '☁️ cloud save connected' : '🌿 garden ready — offline mode'

let started = false
let lastInteract = performance.now()

function syncWorldToState() {
  world.setPagodaTier(state.lvl('pagoda'))
  if (state.lvl('bridge') > 0) world.revealBridge(false)
  if (state.lvl('jade') > 0) world.revealJade(false)
  fauna.setKoi(Math.min(state.lvl('koi'), 8))
  fauna.setButterflies(Math.min(state.lvl('butterflies'), 12))
  fauna.setWisps(Math.min(10, Math.ceil(state.lvl('spirits') / 2)))
  fauna.setFox(state.lvl('fox') > 0, state.lvl('bridge') > 0)
  fauna.setPhoenix(state.lvl('phoenix') > 0)
  fauna.setCranes(Math.min(state.lvl('cranes'), 2))
  fauna.setDragon(state.lvl('dragon') > 0)
  fauna.setRabbit(state.lvl('rabbit') > 0, state.lvl('jade') > 0)
  fauna.setKoiGold(state.lvl('goldenkoi') > 0)
  fx.sakuraLevel = state.lvl('sakura') > 0 ? 1 : 0
  fx.rainActive = state.rainOn && state.lvl('rain') > 0
  world.setLanternCount(5 + Math.min(3, Math.floor(state.lvl('lanterns') / 5)))
  world.setCloudSea(state.lvl('cloudsea') > 0)
  cloudSea.setDense(state.lvl('cloudsea') > 0)
  if (state.lvl('lotusisle') > 0) world.revealLotus(false)
  if (state.lvl('starpeak') > 0) world.revealStar(false)
  world.setRingsVisible(state.stars > 0)
}
syncWorldToState()
builder.loadList(state.placements)

const ui = new UI(state, {
  onIntro() {
    started = true
    audio.init()
    audio.resume()
    audio.setMuted(state.muted)
    audio.setRain(fx.rainActive)
    ui.syncSoundIcon()
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
  onBuildSelect(id) {
    const active = builder.select(id)
    controls.enableRotate = !active
    ui.setSelectedBuild(id)
  },
  onBuildMode(m) { builder.setMode(m) },
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
  }
})

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

document.addEventListener('pointerdown', e => {
  if (radial.isOpen && !e.target.closest?.('#radial')) radial.close()
}, true)

function applyUnlock(id, lvl) {
  switch (id) {
    case 'koi': fauna.setKoi(Math.min(lvl, 8)); break
    case 'butterflies': fauna.setButterflies(Math.min(lvl, 12)); break
    case 'spirits': fauna.setWisps(Math.min(10, Math.ceil(lvl / 2))); break
    case 'fox': fauna.setFox(true, state.lvl('bridge') > 0); break
    case 'phoenix': fauna.setPhoenix(true); break
    case 'sakura':
      fx.sakuraLevel = 1
      ui.toast('🌸 Sakura Breeze — petals drift across the garden')
      break
    case 'pagoda':
      world.setPagodaTier(lvl)
      ui.toast('🗼 The pagoda rises toward the heavens')
      break
    case 'bridge':
      if (!world.isleRevealed) {
        world.revealBridge(true)
        world.onBridgeRevealed = () => {
          fx.burst(world.anchors.bridgeEnd, 'celebrate')
          ui.toast('⛩️ The Torii Isle has risen from the mists')
        }
        if (state.lvl('fox') > 0) fauna.setFox(true, true)
      }
      break
    case 'rain':
      ui.setRainVisible(true)
      ui.toast('🌧️ Monsoon Blessing — toggle rain anytime')
      break
    case 'lanterns':
      world.setLanternCount(5 + Math.min(3, Math.floor(lvl / 5)))
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
    case 'jade':
      if (!world.jadeRevealed) {
        world.revealJade(true)
        world.onJadeRevealed = () => {
          const p = world.anchors.rabbitJade
          fx.burst(new THREE.Vector3(p.x, p.y + 1.5, p.z), 'celebrate')
          ui.toast('🏯 The Jade Terrace rises into the heavens')
          if (state.lvl('rabbit') > 0) fauna.setRabbit(true, true)
        }
      }
      break
    case 'lotusisle':
      if (!world.lotusRevealed) {
        world.revealLotus(true)
        world.onLotusRevealed = () => {
          fx.burst(new THREE.Vector3(-24, 11, 24), 'celebrate')
          ui.toast('🪷 Lotus Haven drifts into view across the stones')
        }
      }
      break
    case 'starpeak':
      if (!world.starRevealed) {
        world.revealStar(true)
        world.onStarRevealed = () => {
          fx.burst(new THREE.Vector3(36, 30, -27), 'celebrate')
          ui.toast('🌟 Star Peak summits the cloud sea')
        }
      }
      break
    case 'rabbit':
      fauna.setRabbit(true, state.lvl('jade') > 0)
      ui.toast(state.lvl('jade') > 0 ? '🐇 The Moon Rabbit pounds the elixir' : '🐇 The Moon Rabbit rests in the garden')
      break
    case 'dragon':
      fauna.setDragon(true)
      ui.toast('🐉 The Azure Celestial Dragon dances among the clouds!')
      audio.dragonCall()
      setTimeout(() => audio.dragonCall(), 2200)
      break
  }
  if (['pagoda', 'fox', 'phoenix', 'bridge', 'jade', 'dragon', 'cloudsea', 'lotusisle', 'starpeak'].includes(id)) {
    fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 4), 'celebrate')
    audio.unlock()
  }
}

state.on('levelup', ({ lvl, reward }) => {
  audio.levelUp()
  ui.pulseCounter()
  const unlockLabel = LEVEL_UNLOCKS[lvl] || 'New blessings await'
  ui.showBanner(`🌱 Garden Level ${lvl}`, `${unlockLabel} · +${fmt(reward)} ✨`)
  fx.burst(world.anchors.pagodaTop.clone().setY(world.anchors.pagodaTop.y - 4), 'celebrate')
  fx.burst(new THREE.Vector3(0, 12, 0), 'gold')
  ui.renderUpgrades()
  ui.renderBuild()
  if (lvl >= 2) ui.setBuildVisible(true)
})

state.on('achievement', ({ a, reward }) => {
  audio.unlock()
  ui.showBanner(`🏆 ${a.name}`, `${a.desc} · +${fmt(reward)} ✨`)
  ui.pulseCounter()
  ui.renderQuests()
})

if (state.lvl('rain') > 0) ui.setRainVisible(true)
ui.setRainOn(fx.rainActive)
if (state.gLevel >= 2) ui.setBuildVisible(true)

function buildInputActive() { return builder.active || ui.removing }

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (radial.isOpen) radial.close()
    else if (document.body.classList.contains('photo-mode')) document.body.classList.remove('photo-mode')
    else if (builder.active || ui.removing) ui.closeBuild()
  } else if (e.code === 'KeyR' && builder.active) {
    builder.rotate()
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
  if (wishStar.g.visible && wishStar.state === 'landed') list.push(...wishStar.g.children)
  list.push(world.water)
  return list
}

const wishStar = { g: null, state: 'idle', timer: 40, landedT: 0, trailT: 0 }
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
    if (!moved && !builder.active) {
      lpFired = true
      radial.open(downX, downY)
    }
  }, 430)
})
canvas.addEventListener('pointermove', e => {
  if (builder.active && builder.mode === 'place') {
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
    if (!builder.active && !ui.removing) controls.enableRotate = true
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

  const amt = state.addTap(mult)
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
let lastCloudStr = ''

renderer.compile(scene, camera)

const quality = { lvl: 2, t: 0, frames: 0, low: 0, high: 0, last: 0 }
function applyQuality(l) {
  quality.lvl = l
  if (l === 2) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    bloom.enabled = true
  } else if (l === 1) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2))
    bloom.enabled = false
  } else {
    renderer.setPixelRatio(1)
    bloom.enabled = false
    sunLight.castShadow = false
    renderer.shadowMap.enabled = false
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true })
  }
  applyResize()
}

async function pushCloud() {
  if (!cloud.ok || !started) return
  const obj = state.serialize()
  const str = JSON.stringify(obj)
  if (str === lastCloudStr) return
  lastCloudStr = str
  const okPush = await cloud.push(obj)
  ui.setCloudState(okPush ? 'on' : 'err')
}

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const tGlob = clock.elapsedTime

  state.tick(dt)
  const env = daynight.update(dt, tGlob)

  const U = voxelUniforms
  U.uTime.value = tGlob
  U.uSunDir.value.copy(sunLight.position).normalize()
  U.uSunColor.value.copy(sunLight.color).multiplyScalar(sunLight.intensity)
  U.uNight.value = env.nf
  U.uTint.value.setRGB(1, 1, 1).lerp(NIGHT_TINT, env.nf * 0.55)

  world.update(dt, tGlob)
  cloudSea.update(dt)
  cloudSea.setNight(env.nf)
  fauna.update(dt)
  fx.update(dt, tGlob, env)
  dock.update()

  fx.setIncense(state.buffActive() ? world.anchors.incense : null)
  if (fauna.goldenG.visible) {
    goldenTrailT.v -= dt
    if (goldenTrailT.v <= 0) {
      goldenTrailT.v = 0.14
      fx.spawnSpark(fauna.goldenG.position, ['#FFE29A', '#FFF6D8', '#FFD27A'])
    }
  }
  if (started && wishStar.state === 'idle') {
    wishStar.timer -= dt
    if (wishStar.timer <= 0) {
      if (env.nf > 0.55) startWishStar()
      else wishStar.timer = 15
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
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -14, 14)
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -14, 14)
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 2, 14)

  composer.render()

  uiAcc += dt
  if (uiAcc > 0.2) { ui.refresh(); uiAcc = 0 }
  achAcc += dt
  if (achAcc > 2) { state.checkAchievements(); achAcc = 0 }
  saveAcc += dt
  if (saveAcc > 5 && started) { state.save(); ui.flashSaved(); saveAcc = 0 }
  cloudAcc += dt
  if (cloudAcc > 20) { pushCloud(); cloudAcc = 0 }

  quality.t += dt
  quality.frames++
  if (quality.t >= 2) {
    const fps = quality.frames / quality.t
    quality.t = 0
    quality.frames = 0
    if (fps < 40) { quality.low++; quality.high = 0 }
    else if (fps > 56) { quality.high++; quality.low = 0 }
    else { quality.low = 0; quality.high = 0 }
    const now = performance.now()
    if (quality.low >= 2 && quality.lvl > 0 && now - quality.last > 4000) {
      applyQuality(quality.lvl - 1)
      quality.last = now
      quality.low = 0
    } else if (quality.high >= 4 && quality.lvl < 2 && now - quality.last > 12000) {
      applyQuality(quality.lvl + 1)
      quality.last = now
      quality.high = 0
    }
  }
}

animate()
