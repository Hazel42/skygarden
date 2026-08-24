import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

import { VoxelSystem } from './voxel.js'
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

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
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
const offline = state.load()

const builder = new Builder(scene, world, state, {
  onPlaced(item, pos) {
    audio.buy()
    fx.burst(pos.clone().setY(pos.y + 1.2), 'poof')
    state.questEvent('placed')
    state.save()
  },
  onRemoved(item, pos) {
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
  }
})

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
  list.push(world.water)
  return list
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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  bloom.resolution.set(window.innerWidth / 2, window.innerHeight / 2)
})

window.addEventListener('beforeunload', () => { if (started) state.save() })
document.addEventListener('visibilitychange', () => {
  if (document.hidden && started) state.save()
  else audio.resume()
})

const clock = new THREE.Clock()
let uiAcc = 0
let saveAcc = 0

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const tGlob = clock.elapsedTime

  state.tick(dt)
  const env = daynight.update(dt, tGlob)
  world.update(dt, tGlob)
  cloudSea.update(dt)
  cloudSea.setNight(env.nf)
  fauna.update(dt)
  fx.update(dt, tGlob, env)
  dock.update()

  fx.setIncense(state.buffActive() ? world.anchors.incense : null)
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
  if (uiAcc > 0.12) { ui.refresh(); uiAcc = 0 }
  saveAcc += dt
  if (saveAcc > 5 && started) { state.save(); saveAcc = 0 }
}

animate()
