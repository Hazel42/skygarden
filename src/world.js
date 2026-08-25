import * as THREE from 'three'
import gsap from 'gsap'
import { C } from './palette.js'
import { mulberry32, vnoise, VoxelGroup } from './voxel.js'

export const TOP = 10
export const ISLE_R = 15
export const POND = { x: -4.5, z: -3.5, r: 4.3 }

const WALLS = [7, 5, 5, 3, 3, 3, 3]
const GRASS = [C.grassA, C.grassB, C.grassC, C.grassA, C.grassD]

// ---- Blossoming Isle: pulau bertumbuh tanpa batas · tanah polos tanpa properti ----
const ISLAND_STAGES = [
  null,
  { R: 8, pondR: 2.6, trees: [], toro: [], stones: [], bamboo: [], path: false, channel: false, tufts: 0, lotus: false, peach: false, incense: false, crystals: false,
    docks: { upgrades: [3, 5.5], build: [-3, 5.5], quests: [0, 7] } },
  { R: 10.5, pondR: 3.4, trees: [], toro: [], stones: [], bamboo: [], path: true, channel: false, tufts: 0, lotus: false, peach: false, incense: false, crystals: false,
    docks: { upgrades: [4, 7], build: [-4, 7], quests: [0, 9.5] } },
  { R: 13, pondR: 4.0, trees: [], toro: [], stones: [], bamboo: [], path: true, channel: true, tufts: 0, lotus: false, peach: false, incense: false, crystals: false,
    docks: { upgrades: [4, 9], build: [-4, 9], quests: [2, 12] } },
  { R: 15, pondR: 4.3, trees: [], toro: [], stones: [], bamboo: [], path: true, channel: true, tufts: 0, lotus: false, peach: false, incense: false, crystals: false,
    docks: { upgrades: [4, 9], build: [-4, 9], quests: [2, 12] }
  }
]

const STAGE_CACHE = new Map()
function proceduralStage(n) {
  if (STAGE_CACHE.has(n)) return STAGE_CACHE.get(n)
  const b = ISLAND_STAGES[4]
  const R = Math.round((b.R + (n - 4) * 2.5) * 10) / 10
  const cfg = {
    R,
    pondR: b.pondR,
    trees: [],
    toro: [],
    stones: [],
    bamboo: [],
    path: true,
    channel: true,
    tufts: 0,
    lotus: false,
    peach: false,
    incense: false,
    crystals: false,
    docks: {
      upgrades: [Math.round(R * 0.28), Math.round(R * 0.52)],
      build: [-Math.round(R * 0.28), Math.round(R * 0.52)],
      quests: [0, Math.min(Math.round(R * 0.68), R - 2)]
    }
  }
  STAGE_CACHE.set(n, cfg)
  return cfg
}

export function stageConfig(n) {
  n = Math.max(1, Math.floor(Number(n) || 1))
  return ISLAND_STAGES[n] || proceduralStage(n)
}
export class World {
  constructor(sys, scene) {
    this.sys = sys
    this.scene = scene
    this.root = new THREE.Group()
    scene.add(this.root)

    this.anchors = {
      pond: { ...POND },
      waterfall: new THREE.Vector3(-12.7, 9.9, -3.5),
      trees: [],
      toroLights: [],
      pagodaTop: new THREE.Vector3(0, 30, 0),
      foxMain: { x: 5, y: 13.62, z: 4 },
      foxIsle: { x: 37, y: 12.42, z: -5.5 },
      bridgeEnd: new THREE.Vector3(30, 12.6, -5.5),
      lotusLight: new THREE.Vector3(POND.x, 10.4, POND.z),
      pagodaDoor: new THREE.Vector3(0, TOP + 2, 3.2)
    }

    this.lanterns = []
    this.clouds = []
    this.cloudSeaPuffs = []
    this.isleRevealed = false
    this.jadeRevealed = false

    this.surfMain = new Map()
    this.surfDawn = new Map()
    this.surfJade = new Map()
    this.surfLotus = new Map()
    this.surfStar = new Map()
    this.waterCells = new Set()

    this.islandVg = sys.group(this.root)
    this.pagodaVg = null
    this.isleGroup = new THREE.Group()
    this.isleGroup.visible = false
    this.root.add(this.isleGroup)

    this.rng = mulberry32(1337)
    this.islandStage = 0
    this.dockProps = []
    this.treesBuilt = false
    this.buildIslandStage(1)
    this.buildFloatingLanterns()
    this.buildClouds()
    this.buildPagoda(0)
    for (let x = -5; x <= 5; x++)
      for (let z = -5; z <= 5; z++) this.surfMain.delete(x + ',' + z)
    this.buildDawnIsle()
    this.buildJadeIsle()
    this.buildRings()
    this.buildLotusIsle()
    this.buildStarPeak()
  }

  setIslandStage(stage, animated = false) {
    stage = Math.max(1, Math.floor(Number(stage) || 1))
    if (stage === this.islandStage) return
    if (stage < this.islandStage && this.peachGroup) {
      this.root.remove(this.peachGroup)
      this.peachGroup.traverse(o => {
        if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.() }
      })
      this.peachGroup = null
      this.peachMeshes = []
    }
    this.buildIslandStage(stage)
    if (animated && this.onIslandGrown === null) { /* noop hook placeholder */ }
    if (animated) {
      const g = this.islandVg.group
      g.position.y = -7
      gsap.to(g.position, { y: 0, duration: 1.5, ease: 'back.out(1.1)' })
      if (this.water) {
        this.water.position.y = 9.2
        gsap.to(this.water.position, { y: 9.74, duration: 1.5, ease: 'back.out(1.1)' })
      }
    }
    if (this.onStageChanged) this.onStageChanged(stage)
  }

  buildLotusIsle(R = 6) {
    if (!this.lotusGroup) {
      this.lotusGroup = new THREE.Group()
      this.lotusGroup.visible = false
      this.root.add(this.lotusGroup)
    }
    if (this.lotusVg) this.lotusVg.destroy()
    if (!this.lotusWaterKeys) this.lotusWaterKeys = new Set()
    for (const k of this.lotusWaterKeys) this.waterCells.delete(k)
    this.lotusWaterKeys.clear()
    this.surfLotus.clear()
    if (this.lotusWater) {
      this.lotusWater.geometry.dispose()
      this.lotusGroup.remove(this.lotusWater)
      this.lotusWater = null
    }
    const vg = this.sys.group(this.lotusGroup)
    this.lotusVg = vg
    const rng = mulberry32(60606)
    const ITOP = 9, CX = -24, CZ = 24
    this.lotusR = R

    for (let x = -R; x <= R; x++)
      for (let z = -R; z <= R; z++) {
        const d = Math.hypot(x, z)
        if (d > R - 0.4 + (vnoise(x * 0.5 + 11, z * 0.5 + 4, 17) - 0.5) * 2) continue
        const bottom = Math.round(ITOP - (1 - Math.min(d / R, 1) ** 2) * 4.5)
        const pd = Math.hypot(x, z)
        const pr = 2.6 + (vnoise(x * 0.6, z * 0.6, 19) - 0.5)
        if (pd < pr) {
          const ck = (CX + x) + ',' + (CZ + z)
          if (pd > pr - 1) {
            vg.add(CX + x, ITOP, CZ + z, C.sand)
            this.surfLotus.set(ck, ITOP)
            for (let yy = ITOP - 1; yy >= bottom; yy--) vg.add(CX + x, yy, CZ + z, C.stone)
          } else {
            this.waterCells.add(ck)
            this.lotusWaterKeys.add(ck)
            for (let yy = bottom; yy <= ITOP - 3; yy++) vg.add(CX + x, yy, CZ + z, C.stoneDeep)
          }
        } else {
          vg.add(CX + x, ITOP, CZ + z, GRASS[Math.floor(vnoise(x, z, 24) * 4)])
          this.surfLotus.set((CX + x) + ',' + (CZ + z), ITOP)
          vg.add(CX + x, ITOP - 1, CZ + z, C.dirtA)
          for (let yy = ITOP - 2; yy >= bottom; yy--) vg.add(CX + x, yy, CZ + z, C.stone)
        }
      }

    this.lotusWater = new THREE.Mesh(
      new THREE.CircleGeometry(2.35, 24),
      new THREE.MeshPhongMaterial({ color: C.water, transparent: true, opacity: 0.66, shininess: 110, specular: '#CFEFFF' })
    )
    this.lotusWater.rotation.x = -Math.PI / 2
    this.lotusWater.position.set(CX, ITOP - 0.15, CZ)
    this.lotusGroup.add(this.lotusWater)

    const b0 = new THREE.Vector3(-13.4, 10.4, 9.6)
    const b2 = new THREE.Vector3(-19.4, 9.6, 19.6)
    const b1 = new THREE.Vector3(-16.6, 12.4, 14.4)
    const N = 8
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const p = new THREE.Vector3()
        .addScaledVector(b0, (1 - t) * (1 - t))
        .addScaledVector(b1, 2 * (1 - t) * t)
        .addScaledVector(b2, t * t)
      vg.add(Math.round(p.x), Math.round(p.y), Math.round(p.z), i % 2 ? C.stone : C.stoneDeep, { size: 1.05 })
    }

    vg.build()
  }

  revealLotus(animated) {
    if (this.lotusRevealed) return
    this.lotusRevealed = true
    this.lotusGroup.visible = true
    if (animated) {
      this.lotusGroup.position.y = -18
      gsap.to(this.lotusGroup.position, {
        y: 0, duration: 2.1, ease: 'back.out(1.2)',
        onComplete: () => { if (this.onLotusRevealed) this.onLotusRevealed() }
      })
    }
  }

  buildStarPeak(exp = 0) {
    if (!this.starGroup) {
      this.starGroup = new THREE.Group()
      this.starGroup.visible = false
      this.root.add(this.starGroup)
    }
    if (this.starVg) this.starVg.destroy()
    this.surfStar.clear()
    const vg = this.sys.group(this.starGroup)
    this.starVg = vg
    const rng = mulberry32(70707)
    const SX = 36, SZ = -27
    const SUMMIT = 21
    this.starExp = exp
    const hwTop = 1 + exp

    for (let lvl = 0; lvl < 12; lvl++) {
      const y = SUMMIT - lvl
      const rad = Math.max(1, Math.round(6.5 - lvl * 0.48))
      for (let x = -rad; x <= rad; x++)
        for (let z = -rad; z <= rad; z++) {
          const d = Math.hypot(x, z)
          if (d > rad - 0.35 + (vnoise(x * 0.7 + lvl, z * 0.7, 27 + lvl) - 0.5) * 1.4) continue
          if (lvl > 0 && d < rad - 1.1 && vnoise(x + lvl * 3, z, 31) < 0.55) continue
          const col = d > rad - 0.9 ? C.stoneDeep : (vnoise(x * 0.5, z * 0.5 + lvl, 33) > 0.72 ? C.moss : C.stone)
          vg.add(SX + x, y, SZ + z, col)
        }
    }
    for (let x = -hwTop; x <= hwTop; x++)
      for (let z = -hwTop; z <= hwTop; z++) {
        if (Math.hypot(x, z) > hwTop + 0.35) continue
        vg.add(SX + x, SUMMIT + 1, SZ + z, GRASS[Math.floor(vnoise(x, z, 35) * 4)])
        this.surfStar.set((SX + x) + ',' + (SZ + z), SUMMIT + 1)
      }

    const b0 = new THREE.Vector3(37.5, 11.8, -11.6)
    const b2 = new THREE.Vector3(36.5, SUMMIT + 1.4, -25.6)
    const b1 = new THREE.Vector3(39.5, 9.2, -18)
    const side = new THREE.Vector3(0.94, 0, 0.34).normalize()
    const N = 14
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const p = new THREE.Vector3()
        .addScaledVector(b0, (1 - t) * (1 - t))
        .addScaledVector(b1, 2 * (1 - t) * t)
        .addScaledVector(b2, t * t)
      vg.add(Math.round(p.x), Math.round(p.y), Math.round(p.z), i % 2 ? C.wood : C.woodDark)
      if (i % 2 === 0) {
        for (const sgn of [1, -1])
          vg.add(Math.round(p.x + side.x * sgn), Math.round(p.y) + 1, Math.round(p.z + side.z * sgn),
            C.woodDark, { size: 0.42 })
      }
    }

    vg.build()
  }

  revealStar(animated) {
    if (this.starRevealed) return
    this.starRevealed = true
    this.starGroup.visible = true
    if (animated) {
      this.starGroup.position.y = -26
      gsap.to(this.starGroup.position, {
        y: 0, duration: 2.5, ease: 'back.out(1.15)',
        onComplete: () => { if (this.onStarRevealed) this.onStarRevealed() }
      })
    }
  }

  makeTreeOn(vg, tx, tz, topY, h, rad) {
    const rng = mulberry32(tx * 13 + tz * 29)
    for (let i = 1; i <= h; i++) vg.add(tx, topY + i, tz, i % 2 ? C.wood : C.woodDark, { size: 0.55 })
    const cols = [C.blossomA, C.blossomB, C.blossomC]
    for (let i = 0; i < 18; i++) {
      const ox = (rng() * 2 - 1) * rad, oy = (rng() * 2 - 1) * rad * 0.6, oz = (rng() * 2 - 1) * rad
      if ((ox / rad) ** 2 + (oy / (rad * 0.7)) ** 2 + (oz / rad) ** 2 > 1) continue
      vg.add(tx + Math.round(ox), topY + h + 1 + Math.round(oy), tz + Math.round(oz),
        rng() < 0.08 ? C.blossomGlow : cols[Math.floor(rng() * 3)],
        rng() < 0.08
          ? { glow: true, size: 0.5, sway: 0.6 }
          : { size: 0.58, sway: 0.45 + rng() * 0.45, sss: 0.85 })
    }
    this.anchors.trees.push({ x: tx, y: topY + h + 2, z: tz, rad })
  }

  buildDockProps() {
    this.dockMeshes = []
    this.dockBobs = []
    const mkOrb = (g, hex) => {
      const orb = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.38, 0.38),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.3), toneMapped: false })
      )
      g.add(orb)
      return orb
    }
    const tag = (g, key) => g.traverse(o => {
      if (o.isMesh) { o.userData.special = 'dock'; o.userData.dockKey = key; this.dockMeshes.push(o) }
    })
    const placeAt = (x, z) => {
      const key = x + ',' + z
      const topY = this.surfMain.get(key) ?? TOP
      this.surfMain.delete(key)
      return topY
    }

    const mkSign = (x, z, key, hex) => {
      const g = new THREE.Group()
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.7, 0.3), new THREE.MeshLambertMaterial({ color: C.woodDark }))
      post.position.y = 0.85
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.22), new THREE.MeshLambertMaterial({ color: C.trim }))
      board.position.y = 1.75
      const orb = mkOrb(g, hex)
      orb.position.y = 2.65
      g.add(post, board)
      const topY = placeAt(x, z)
      g.position.set(x, topY, z)
      tag(g, key)
      this.root.add(g)
      this.dockProps.push(g)
      this.dockBobs.push({ orb, baseY: 2.65, ph: x })
      this.anchors['dock_' + key] = new THREE.Vector3(x, topY + 2.6, z)
    }

    const mkCrate = (x, z, key, hex) => {
      const g = new THREE.Group()
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.7, 0.95), new THREE.MeshLambertMaterial({ color: C.wood }))
      base.position.y = 0.35
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.4, 0.75), new THREE.MeshLambertMaterial({ color: C.woodDark }))
      top.position.y = 0.9
      const orb = mkOrb(g, hex)
      orb.position.y = 1.7
      g.add(base, top)
      g.position.set(x, placeAt(x, z), z)
      tag(g, key)
      this.root.add(g)
      this.dockProps.push(g)
      this.dockBobs.push({ orb, baseY: 1.7, ph: z })
      this.anchors['dock_' + key] = new THREE.Vector3(x, g.position.y + 1.7, z)
    }

    const mkBoard = (x, z, key, hex) => {
      const g = new THREE.Group()
      const mat = new THREE.MeshLambertMaterial({ color: C.woodDark })
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.9, 0.26), mat)
      p1.position.set(-0.85, 0.95, 0)
      const p2 = p1.clone()
      p2.position.x = 0.85
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 0.22), new THREE.MeshLambertMaterial({ color: C.trim }))
      board.position.y = 1.45
      const orb = mkOrb(g, hex)
      orb.position.y = 2.45
      g.add(p1, p2, board)
      g.position.set(x, placeAt(x, z), z)
      tag(g, key)
      this.root.add(g)
      this.dockProps.push(g)
      this.dockBobs.push({ orb, baseY: 2.45, ph: x + z })
      this.anchors['dock_' + key] = new THREE.Vector3(x, g.position.y + 2.4, z)
    }

    const dc = stageConfig(this.islandStage).docks
    mkSign(dc.upgrades[0], dc.upgrades[1], 'upgrades', '#FFC9DC')
    mkCrate(dc.build[0], dc.build[1], 'build', '#A8E8DC')
    mkBoard(dc.quests[0], dc.quests[1], 'quests', '#FFF0B8')
  }

  cellAt(x, z) {
    const k = x + ',' + z
    if (this.surfJade.has(k)) return { kind: 'land', top: this.surfJade.get(k), prefix: 'J' }
    if (this.surfDawn.has(k)) return { kind: 'land', top: this.surfDawn.get(k), prefix: 'D' }
    if (this.surfLotus.has(k)) return { kind: 'land', top: this.surfLotus.get(k), prefix: 'L' }
    if (this.surfStar.has(k)) return { kind: 'land', top: this.surfStar.get(k), prefix: 'S' }
    if (this.surfMain.has(k)) return { kind: 'land', top: this.surfMain.get(k), prefix: '' }
    if (this.waterCells.has(k)) return { kind: 'water', top: 9.74, prefix: '' }
    return null
  }

  groundTargets() {
    const list = [...this.islandVg.group.children]
    if (this.isleRevealed) list.push(...this.isleVg.group.children)
    if (this.jadeRevealed && this.jadeVg) list.push(...this.jadeVg.group.children)
    if (this.lotusRevealed && this.lotusVg) {
      list.push(...this.lotusVg.group.children)
      list.push(this.lotusWater)
    }
    if (this.starRevealed && this.starVg) list.push(...this.starVg.group.children)
    list.push(this.water)
    return list
  }

  buildIslandStage(stage) {
    if (this.islandVg) this.islandVg.destroy()
    if (this.water) {
      this.water.geometry.dispose()
      this.root.remove(this.water)
      this.water = null
    }
    for (const g of this.dockProps) {
      g.traverse(o => {
        if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.() }
      })
      this.root.remove(g)
    }
    this.dockProps = []
    this.dockMeshes = []
    this.dockBobs = []
    this.anchors.trees = []
    this.anchors.toroLights = []

    const cfg = stageConfig(stage)
    this.islandStage = stage
    this.waterfallOn = !!cfg.channel
    this.R = cfg.R
    this.pondR = cfg.pondR
    this.anchors.pond = { x: POND.x, z: POND.z, r: cfg.pondR }

    const vg = this.sys.group(this.root)
    this.islandVg = vg
    const R = cfg.R

    for (let x = -R; x <= R; x++) {
      for (let z = -R; z <= R; z++) {
        const d = Math.hypot(x, z)
        const edge = R - 0.6 + (vnoise(x * 0.45 + 9, z * 0.45, 5) - 0.5) * 2.6
        if (d > edge) continue

        const bump = Math.round(vnoise(x * 0.35, z * 0.35, 7) * 1.8 - 0.9)
        const topY = d < 7.5 ? TOP : TOP + bump
        const bottom = Math.round(TOP - (1 - Math.min(d / R, 1) ** 2) * 7.5 - vnoise(x * 0.6, z * 0.6, 11) * 2)

        const pd = Math.hypot(x - POND.x, z - POND.z)
        const pr = cfg.pondR + (vnoise(x * 0.5, z * 0.5, 3) - 0.5) * 1.3
        const inChannel = cfg.channel && x <= -9 && x >= -13 && (z === -4 || z === -3) && x <= Math.floor(edge) - 1

        if (pd < pr || inChannel) {
          const ck = x + ',' + z
          if (inChannel || pd > pr - 1.7) {
            if (inChannel) {
              vg.add(x, topY, z, '#9FE8F2', { glow: true })
              this.waterCells.add(ck)
            } else {
              vg.add(x, topY, z, C.sand)
              this.surfMain.set(ck, topY)
            }
            for (let y = topY - 1; y >= bottom; y--)
              vg.add(x, y, z, y < topY - 3 ? C.stoneDeep : C.stone)
          } else {
            this.waterCells.add(ck)
            for (let y = bottom; y <= TOP - 4; y++)
              vg.add(x, y, z, y < TOP - 6 ? C.stoneDeep : C.stone)
          }
          continue
        }

        const onPathS = cfg.path && Math.abs(x) <= 1 && z >= 6 && z <= 8 && topY === TOP
        const onPathE = cfg.path && R >= 14 && z >= 0 && z <= 1 && x >= 10 && x <= 15 && topY === TOP
        const steps = cfg.path && R >= 13 && (x === 0 && (z === 10 || z === 12))
        if (onPathS || onPathE || steps) {
          vg.add(x, topY, z, C.sand)
        } else {
          vg.add(x, topY, z, GRASS[Math.floor(vnoise(x * 0.8, z * 0.8, 21) * GRASS.length)])
        }
        this.surfMain.set(x + ',' + z, topY)
        vg.add(x, topY - 1, z, vnoise(x, z, 31) > 0.5 ? C.dirtA : C.dirtB)
        vg.add(x, topY - 2, z, C.dirtB)
        for (let y = topY - 3; y >= bottom; y--)
          vg.add(x, y, z, y < topY - 4 ? C.stoneDeep : C.stone)
      }
    }

    const tuftRng = mulberry32(777)
    for (let i = 0; i < cfg.tufts; i++) {
      const a = tuftRng() * Math.PI * 2
      const rr = Math.sqrt(tuftRng()) * (R - 2)
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr
      const d = Math.hypot(x, z)
      if (d < 7.5) continue
      const pd = Math.hypot(x - POND.x, z - POND.z)
      if (pd < cfg.pondR + 1.2) continue
      if (cfg.channel && x <= -8 && z >= -5 && z <= -2) continue
      const bump = Math.round(vnoise(x * 0.35, z * 0.35, 7) * 1.8 - 0.9)
      const topY = TOP + bump
      if (tuftRng() < 0.68) {
        vg.add(x, topY + 0.68, z, tuftRng() < 0.5 ? C.grassD : C.bambooLight, { size: 0.3, sway: 1 })
      } else {
        const fc = ['#FF9EC0', '#FFF3A6', '#FFFFFF', '#C9A7FF'][Math.floor(tuftRng() * 4)]
        vg.add(x, topY + 0.7, z, fc, { size: 0.34, sway: 1, sss: 0.4 })
      }
    }

    const edgeRng = mulberry32(313)
    for (let x = -R; x <= R; x++)
      for (let z = -R; z <= R; z++) {
        const key = x + ',' + z
        if (!this.surfMain.has(key)) continue
        const d = Math.hypot(x, z)
        const edge = R - 0.6 + (vnoise(x * 0.45 + 9, z * 0.45, 5) - 0.5) * 2.6
        if (d < edge - 1.25) continue
        vg.add(x, this.surfMain.get(key) - 0.3, z, C.grassC, { size: 1.06 })
      }
    for (let i = 0; i < Math.floor(cfg.tufts * 0.18); i++) {
      const a = edgeRng() * Math.PI * 2
      const rr = R - 1.2 + edgeRng() * 2.2
      const x = Math.round(Math.cos(a) * rr), z = Math.round(Math.sin(a) * rr)
      const key = x + ',' + z
      if (!this.surfMain.has(key)) continue
      const topY = this.surfMain.get(key)
      const len = 1 + Math.floor(edgeRng() * 3)
      for (let v = 0; v < len; v++) {
        vg.add(x + (edgeRng() - 0.5) * 0.24, topY - 0.55 - v * 0.28, z + (edgeRng() - 0.5) * 0.24,
          edgeRng() < 0.5 ? C.moss : '#7A9A4A',
          { size: Math.max(0.18, 0.3 - v * 0.04), sway: 0.65 })
      }
    }

    for (const [tx, tz, variant, h, rad] of cfg.trees) this.makeTree(tx, tz, h, rad, variant)
    for (const [bx, bz] of cfg.bamboo) this.makeBamboo(bx, bz)
    for (const [sx, sz] of cfg.stones) this.makeStone(sx, sz, sx === -2 && sz === -7)
    for (const [px, pz] of cfg.toro) this.makeToro(px, pz)
    if (cfg.lotus) this.makeLotus()

    if (cfg.crystals) {
      for (let i = 0; i < 6; i++) {
        const a = this.rng() * Math.PI * 2
        const rr = this.rng() * 2.6
        vg.add(Math.cos(a) * rr, 1.5 + Math.floor(this.rng() * 3), Math.sin(a) * rr,
          this.rng() < 0.6 ? C.crystalA : C.crystalB, { glow: true, size: 0.55 + this.rng() * 0.45 })
      }
    }

    if (cfg.channel) {
      vg.add(-12.2, TOP + 0.87, -2.1, C.stoneDeep, { size: 0.72 })
      vg.add(-12.4, TOP + 0.91, -4.9, C.stone, { size: 0.8 })
      vg.add(-12.9, TOP + 0.81, -3.5, C.stoneDeep, { size: 0.6 })
      vg.add(-11.9, TOP + 0.7, -3.5, C.moss, { size: 0.5 })
    }

    if (cfg.peach && !this.peachGroup) this.buildPeachTree(-11, 4)
    if (cfg.incense) this.buildIncense(3, 7)
    else this.anchors.incense = null

    this.buildWater()
    this.buildDockProps()
    vg.build()
  }

  makeTree(tx, tz, h, rad, variant = 'sakura') {
    const vg = this.islandVg
    const rng = mulberry32(tx * 31 + tz * 17 + 5)
    const baseY = this.surfMain.get(tx + ',' + tz) ?? TOP
    this.surfMain.delete(tx + ',' + tz)

    const isPlum = variant === 'plum'
    const B_LO = isPlum ? '#C2558F' : C.blossomC
    const B_MID = isPlum ? '#E87FB8' : C.blossomB
    const B_HI = isPlum ? '#F7B8D9' : C.blossomA
    const B_TIP = isPlum ? '#FFF0F7' : '#FFE4EF'
    const B_GLOW = isPlum ? '#FFD9EC' : C.blossomGlow

    for (const [ox, oz, s] of [[0.75, 0.25, 0.52], [-0.65, 0.45, 0.48], [0.1, -0.8, 0.5], [-0.3, -0.55, 0.42]])
      vg.add(tx + ox, baseY + 0.3, tz + oz, C.woodDark, { size: s })

    const lean = (rng() * 2 - 1) * 0.9
    const leanZ = (rng() * 2 - 1) * 0.9
    let px = tx, pz = tz
    for (let i = 0; i < h; i++) {
      const t = i / Math.max(1, h - 1)
      px = tx + lean * t
      pz = tz + leanZ * t
      vg.add(px, baseY + 0.55 + i, pz,
        i % 2 ? C.wood : C.woodDark,
        { size: 0.68 - t * 0.16 })
    }
    const topX = px, topZ = pz
    const topY = baseY + 0.55 + h

    const nArms = 3 + Math.floor(rng() * 2)
    const armTips = []
    for (let a = 0; a < nArms; a++) {
      const ang = (a / nArms) * Math.PI * 2 + rng() * 0.8
      const dx = Math.cos(ang), dz = Math.sin(ang)
      const ay = topY - 1.2 + Math.floor(rng() * 2)
      vg.add(topX + dx * 0.75, ay, topZ + dz * 0.75, C.wood, { size: 0.52 })
      const ex = topX + dx * 1.5, ez = topZ + dz * 1.5
      vg.add(ex, ay + 0.35, ez, C.woodDark, { size: 0.4 })
      vg.add(ex + dx * 0.5, ay + 0.8, ez + dz * 0.5, C.wood, { size: 0.32 })
      armTips.push([ex + dx * 0.5, ay + 0.8, ez + dz * 0.5])
    }

    const cy = topY + 1.4
    const layers = [
      { ly: cy, lr: rad * 1.12, cols: [B_LO, B_MID], inner: 0.15 },
      { ly: cy + 0.85, lr: rad * 0.92, cols: [B_MID, B_HI], inner: 0.1 },
      { ly: cy + 1.7, lr: rad * 0.62, cols: [B_HI, B_TIP], inner: 0 }
    ]
    const seen = new Set()
    for (const { ly, lr, cols, inner } of layers) {
      const steps = Math.max(8, Math.round(lr * 7))
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2 + rng() * 0.4
        const rr = lr * (inner + (1 - inner) * Math.sqrt(rng()))
        const ox = Math.cos(a) * rr + (rng() - 0.5) * 0.5
        const oz = Math.sin(a) * rr + (rng() - 0.5) * 0.5
        const oy = (rng() - 0.5) * 0.55
        const gx = Math.round(topX * 0.35 + ox), gz = Math.round(topZ * 0.35 + oz)
        const gy = Math.round(ly + oy)
        const k = gx + ',' + gy + ',' + gz
        if (seen.has(k)) continue
        seen.add(k)
        const r = rng()
        const opts = { sway: 0.4 + rng() * 0.5, sss: 0.85 }
        if (r < 0.05) vg.add(gx, gy, gz, B_GLOW, { glow: true, sway: opts.sway, size: 0.5 })
        else vg.add(gx, gy, gz, cols[Math.floor(rng() * cols.length)], opts)
      }
    }

    for (const [ax, ay, az] of armTips) {
      for (let i = 0; i < 5; i++) {
        const ox = (rng() * 2 - 1) * 0.8, oz = (rng() * 2 - 1) * 0.8
        vg.add(Math.round(ax + ox), Math.round(ay + 0.4 + rng() * 0.5), Math.round(az + oz),
          rng() < 0.3 ? B_TIP : B_MID, { size: 0.5, sway: 0.55 + rng() * 0.4, sss: 0.85 })
      }
    }

    const rimN = Math.max(4, Math.round(rad * 2.2))
    for (let i = 0; i < rimN; i++) {
      const a = (i / rimN) * Math.PI * 2 + rng() * 0.5
      const rr = rad * (0.95 + rng() * 0.25)
      const hx = Math.round(topX + Math.cos(a) * rr)
      const hz = Math.round(topZ + Math.sin(a) * rr)
      const hy = Math.round(cy - 0.3 - rng() * 0.5)
      vg.add(hx, hy, hz, B_MID, { size: 0.5, sway: 0.8, sss: 0.6 })
      if (rng() < 0.55) vg.add(hx, hy - 0.55, hz, B_LO, { size: 0.38, sway: 1, sss: 0.6 })
      if (rng() < 0.25) vg.add(hx, hy - 1.05, hz, B_GLOW, { size: 0.3, sway: 1.1, sss: 0.5 })
    }

    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2
      const rr = 1.2 + rng() * 1.6
      const gx = tx + Math.round(Math.cos(a) * rr)
      const gz = tz + Math.round(Math.sin(a) * rr)
      if (this.surfMain.has(gx + ',' + gz)) {
        vg.add(gx, this.surfMain.get(gx + ',' + gz) + 0.72, gz,
          rng() < 0.5 ? B_HI : B_MID, { size: 0.26 })
      }
    }
    this.anchors.trees.push({ x: tx, y: cy + 1, z: tz, rad })
  }

  makeBamboo(bx, bz) {
    const vg = this.islandVg
    const rng = mulberry32(bx * 13 + bz * 7)
    const n = 3 + Math.floor(rng() * 3)
    for (let s = 0; s < n; s++) {
      const x = bx + Math.round((rng() * 2 - 1) * 1.6)
      const z = bz + Math.round((rng() * 2 - 1) * 1.6)
      const d = Math.hypot(x, z)
      if (d < 7.5 || d > (this.R || ISLE_R) - 1) continue
      const h = 5 + Math.floor(rng() * 3)
      for (let i = 0; i < h; i++)
        vg.add(x, TOP + 1 + i, z, i % 3 === 2 ? C.bambooLight : C.bamboo, { size: 0.42, sway: 0.22 })
      vg.add(x + 1, TOP + h, z, C.bambooLight, { size: 0.36, sway: 0.75, sss: 0.6 })
      vg.add(x - 1, TOP + h - 1, z, C.bambooLight, { size: 0.36, sway: 0.75, sss: 0.6 })
      if (rng() < 0.7) {
        vg.add(x + 1.1 + (rng() - 0.5) * 0.3, TOP + 0.7, z + 0.7 + (rng() - 0.5) * 0.3,
          C.bambooLight, { size: 0.26, sway: 0.5 })
      }
    }
  }

  makeStone(sx, sz, tall) {
    const vg = this.islandVg
    const rng = mulberry32(sx * 41 + sz * 29)
    const lv = tall ? 3 : 2
    for (let l = 0; l < lv; l++) {
      const w = (lv === 3 ? 3 : 2) - Math.floor(l / 2)
      const off = Math.floor(w / 2)
      for (let i = -off; i <= off; i++)
        for (let j = -off; j <= off; j++) {
          if (Math.abs(i) === off && Math.abs(j) === off && rng() < 0.5) continue
          const mossy = (l === lv - 1 && rng() < 0.65) || rng() < 0.12
          vg.add(sx + i, TOP + 1 + l, sz + j,
            mossy ? C.moss : (rng() < 0.5 ? C.stone : C.stoneDeep),
            { size: 0.92 + rng() * 0.08 })
        }
      if (l < lv - 1 && rng() < 0.6) {
        vg.add(sx + (rng() - 0.5) * 1.4, TOP + 1 + l + 0.62, sz + (rng() - 0.5) * 1.4,
          C.moss, { size: 0.3 })
      }
    }
  }

  makeToro(px, pz) {
    const vg = this.islandVg
    let y = TOP + 1
    vg.add(px, y, pz, C.stoneDeep, { size: 1.1 }); y += 0.55
    vg.add(px, y + 0.3, pz, C.stone, { size: 0.6 }); y += 0.6
    vg.add(px, y + 0.4, pz, C.stoneDeep, { size: 0.8 }); y += 0.8
    vg.add(px, y + 0.36, pz, '#FFE2A8', { win: true, size: 0.72 })
    for (const [ox, oz] of [[0.34, 0.34], [-0.34, 0.34], [0.34, -0.34], [-0.34, -0.34]]) {
      vg.add(px + ox, y + 0.36, pz + oz, C.woodDark, { size: 0.22 })
    }
    this.anchors.toroLights.push(new THREE.Vector3(px, y + 0.36, pz))
    y += 0.72
    vg.add(px, y + 0.475, pz, C.stoneDeep, { size: 0.95 }); y += 0.95
    vg.add(px, y + 0.56, pz, C.stone, { size: 1.12 }); y += 1.12
    vg.add(px, y + 0.3, pz, C.stoneDeep, { size: 0.6 }); y += 0.6
    vg.add(px, y + 0.14, pz, C.gold, { glow: true, size: 0.28 })
  }

  makeLotus() {
    const vg = this.islandVg
    const rng = mulberry32(4242)
    const pr = this.pondR || POND.r
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2
      const rr = rng() * Math.max(0.8, pr - 1.8)
      const x = Math.round(POND.x + Math.cos(a) * rr)
      const z = Math.round(POND.z + Math.sin(a) * rr)
      vg.add(x, 9.92, z, C.lotusLeaf, { size: 0.85 })
    }
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2
      const rr = pr - 1.3 + rng() * 0.9
      const x = Math.round(POND.x + Math.cos(a) * rr)
      const z = Math.round(POND.z + Math.sin(a) * rr)
      const key = x + ',' + z
      if (!this.surfMain.has(key)) continue
      vg.add(x + (rng() - 0.5) * 0.4, this.surfMain.get(key) + 0.62, z + (rng() - 0.5) * 0.4,
        rng() < 0.4 ? C.moss : (rng() < 0.5 ? C.stone : C.stoneDeep),
        { size: 0.26 + rng() * 0.18 })
    }
    const spots = pr > 3.2 ? [[-4, -3], [-6, -4.5], [-3, -5.5]] : [[-4, -3]]
    for (const [fx, fz] of spots) {
      vg.add(fx, 9.9, fz, C.lotusLeaf, { size: 1 })
      const petals = [[0, 0, 0.55], [0, 0, -0.55], [0.55, 0, 0], [-0.55, 0, 0]]
      for (const [ox, , oz] of petals) vg.add(fx + ox, 10.25, fz + oz, C.lotusFlower, { size: 0.42 })
      vg.add(fx, 10.5, fz, C.gold, { glow: true, size: 0.34 })
    }
  }

  buildWater() {
    const pr = this.pondR || POND.r
    const geo = new THREE.CircleGeometry(pr - 0.55, 30)
    if (!this.waterMat) {
      this.waterMat = new THREE.MeshPhongMaterial({
        color: C.water, transparent: true, opacity: 0.66,
        shininess: 110, specular: '#CFEFFF'
      })
    }
    this.water = new THREE.Mesh(geo, this.waterMat)
    this.water.rotation.x = -Math.PI / 2
    this.water.position.set(POND.x, 9.74, POND.z)
    this.water.renderOrder = 2
    this.root.add(this.water)
  }

  buildFloatingLanterns() {
    const rng = mulberry32(9001)
    const coreGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85)
    const capGeo = new THREE.BoxGeometry(1.05, 0.22, 1.05)
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.lanternCore).multiplyScalar(1.35), toneMapped: false
    })
    const capMat = new THREE.MeshLambertMaterial({ color: C.lanternFrame })
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group()
      const core = new THREE.Mesh(coreGeo, coreMat)
      const capT = new THREE.Mesh(capGeo, capMat)
      const capB = new THREE.Mesh(capGeo, capMat)
      capT.position.y = 0.55; capB.position.y = -0.55
      g.add(core, capT, capB)
      const inner = i < 3
      const rec = {
        g,
        ang: (i / 8) * Math.PI * 2 + rng() * 0.6,
        rad: inner ? 17 + rng() * 3 : 20 + rng() * 6,
        y: 13 + rng() * 9,
        spd: (0.014 + rng() * 0.02) * (rng() < 0.5 ? 1 : -1),
        ph: rng() * Math.PI * 2,
        spin: 0.2 + rng() * 0.3,
        busy: false
      }
      g.traverse(o => {
        if (o.isMesh) { o.userData.special = 'lantern'; o.userData.idx = i }
      })
      this.lanterns.push(rec)
      this.root.add(g)
    }
    this.setLanternCount(5)
  }

  releaseLantern(i) {
    const L = this.lanterns[i]
    if (!L || L.busy || !L.g.visible) return false
    L.busy = true
    const startPos = L.g.position.clone()
    gsap.to(L.g.position, {
      y: L.y + 15, duration: 2.4, ease: 'power1.in',
      onComplete: () => {
        L.ang = Math.random() * Math.PI * 2
        L.rad = 19 + Math.random() * 7
        L.g.position.set(Math.cos(L.ang) * L.rad, L.y, Math.sin(L.ang) * L.rad)
        L.busy = false
        if (this.onLanternReleased) this.onLanternReleased(startPos)
      }
    })
    return true
  }

  setLanternCount(n) {
    this.lanterns.forEach((L, i) => (L.g.visible = i < n))
  }

  buildClouds() {
    this.clouds = []
    this.cloudSeaPuffs = []
  }

  buildPagoda(tier) {
    if (this.pagodaVg) this.pagodaVg.destroy()
    const vg = this.sys.group(this.root)
    this.pagodaVg = vg

    vg.box(-5, TOP, -5, 11, 1, 11, C.stone)
    for (let i = -5; i <= 5; i += 2) {
      if (Math.abs(i) <= 1) continue
      vg.add(i, TOP + 0.85, -5, C.column, { size: 0.34 })
      vg.add(i, TOP + 0.85, 5, C.column, { size: 0.34 })
      if (Math.abs(i) > 1) {
        vg.add(-5, TOP + 0.85, i, C.column, { size: 0.34 })
        vg.add(5, TOP + 0.85, i, C.column, { size: 0.34 })
      }
    }
    for (const sx of [-0.35, 0.35]) {
      vg.add(sx, TOP + 0.55, 5.9, C.stone, { size: 0.85 })
      vg.add(sx, TOP + 0.18, 6.75, C.stoneDeep, { size: 0.85 })
    }
    for (const sx of [-1.6, 1.6]) {
      vg.add(sx, TOP + 1.55, 5.6, '#FFB36B', { glow: true, size: 0.3 })
      vg.add(sx, TOP + 1.2, 5.6, C.stoneDeep, { size: 0.34 })
    }
    const stories = 3 + tier
    let y = TOP + 1
    for (let s = 0; s < stories; s++) {
      const w = WALLS[Math.min(s, WALLS.length - 1)]
      const hw = (w - 1) / 2
      for (let x = -hw; x <= hw; x++)
        for (let z = -hw; z <= hw; z++) {
          const edge = Math.abs(x) === hw || Math.abs(z) === hw
          if (!edge) continue
          const corner = Math.abs(x) === hw && Math.abs(z) === hw
          if (corner) {
            vg.add(x, y, z, C.column)
            vg.add(x, y + 1, z, C.column)
            vg.add(x, y + 2, z, C.column)
          } else {
            const doorSide = z === hw && s === 0
            if (doorSide) {
              vg.add(x, y, z, '#4A3428')
              if (Math.abs(x) <= 1) vg.add(x, y + 1, z, '#4A3428')
              else vg.add(x, y + 1, z, C.wall)
            } else {
              vg.add(x, y, z, C.wall)
              const isWin = ((x + z) & 1) === 1
              vg.add(x, y + 1, z, isWin ? C.window : C.wall, isWin ? { win: true } : {})
            }
            vg.add(x, y + 2, z, C.trim)
          }
        }
      if (s === 0) {
        for (const lx of [-2, 2]) {
          vg.add(lx, y + 1.9, hw + 0.55, '#FFB36B', { glow: true, size: 0.34 })
          vg.add(lx, y + 2.35, hw + 0.55, C.woodDark, { size: 0.22 })
        }
      }
      for (const [cx2, cz2] of [[hw, hw], [hw, -hw], [-hw, hw], [-hw, -hw]]) {
        const ox = cx2 > 0 ? 0.16 : -0.16
        const oz = cz2 > 0 ? 0.16 : -0.16
        vg.add(cx2 + ox, y + 2.42, cz2 + oz, C.woodDark, { size: 0.48 })
        vg.add(cx2 + ox, y + 2.76, cz2 + oz, C.wood, { size: 0.4 })
      }
      y = this.buildRoof(vg, y + 3, w)
    }
    vg.add(0, y, 0, C.gold, { size: 0.7 })
    vg.add(0, y + 1, 0, C.gold, { size: 0.55 })
    vg.add(0, y + 2, 0, C.gold, { glow: true, size: 0.85 })
    vg.build()
    this.anchors.pagodaTop.set(0, y + 3, 0)
  }

  buildRoof(vg, yStart, w) {
    let rw = w + 4, y = yStart
    const startRW = rw
    const hw0 = (startRW - 1) / 2
    for (const [sx, sz] of [[hw0, hw0], [hw0, -hw0], [-hw0, hw0], [-hw0, -hw0]]) {
      vg.add(sx, yStart - 0.55, sz, C.gold, { glow: true, size: 0.42 })
      vg.add(sx, yStart + 0.42, sz, C.trim, { size: 0.62 })
      vg.add(sx, yStart + 0.95, sz, C.gold, { glow: true, size: 0.3 })
    }
    while (rw >= w) {
      const hw = (rw - 1) / 2
      for (let x = -hw; x <= hw; x++)
        for (let z = -hw; z <= hw; z++) {
          const outer = Math.abs(x) === hw || Math.abs(z) === hw
          let col
          if (rw === startRW && outer) col = C.trim
          else col = ((x + z) & 1) === 0 ? C.roofA : C.roofB
          vg.add(x, y, z, col)
        }
      if (rw === startRW) {
        for (let e = -hw + 1; e <= hw - 1; e++) {
          vg.add(e, y - 0.32, hw, C.trim, { size: 0.55 })
          vg.add(e, y - 0.32, -hw, C.trim, { size: 0.55 })
          vg.add(hw, y - 0.32, e, C.trim, { size: 0.55 })
          vg.add(-hw, y - 0.32, e, C.trim, { size: 0.55 })
        }
        for (const [mx, mz] of [[0, hw], [0, -hw], [hw, 0], [-hw, 0]]) {
          vg.add(mx, y + 0.42, mz, C.trim, { size: 0.5 })
          vg.add(mx, y + 0.88, mz, C.gold, { glow: true, size: 0.24 })
        }
      }
      y++
      rw -= 2
    }
    const topHw = (w - 1) / 2
    for (let i = -topHw; i <= topHw; i++) {
      vg.add(i, y - 0.58, -topHw, C.gold, { size: 0.36 })
      vg.add(i, y - 0.58, topHw, C.gold, { size: 0.36 })
    }
    for (const [cx2, cz2] of [[topHw, topHw], [topHw, -topHw], [-topHw, topHw], [-topHw, -topHw]]) {
      vg.add(cx2, y - 0.12, cz2, C.column, { size: 0.52 })
      vg.add(cx2, y + 0.38, cz2, C.gold, { glow: true, size: 0.3 })
    }
    return y
  }

  buildDawnIsle(R = 7) {
    if (this.isleVg) this.isleVg.destroy()
    this.surfDawn.clear()
    const vg = this.sys.group(this.isleGroup)
    this.isleVg = vg
    const rng = mulberry32(2024)
    const ITOP = 11, CX = 34, CZ = -6
    this.dawnR = R

    for (let x = -R; x <= R; x++)
      for (let z = -R; z <= R; z++) {
        const d = Math.hypot(x, z)
        if (d > R - 0.4 + (vnoise(x * 0.5 + 3, z * 0.5, 8) - 0.5) * 2) continue
        const bottom = Math.round(ITOP - (1 - Math.min(d / R, 1) ** 2) * 5)
        vg.add(CX + x, ITOP, CZ + z, GRASS[Math.floor(vnoise(x, z, 22) * 4)])
        this.surfDawn.set((CX + x) + ',' + (CZ + z), ITOP)
        vg.add(CX + x, ITOP - 1, CZ + z, C.dirtA)
        for (let yy = ITOP - 2; yy >= bottom; yy--) vg.add(CX + x, yy, CZ + z, yy < ITOP - 3 ? C.stoneDeep : C.stone)
      }

    vg.box(CX - 2, ITOP, CZ - 2, 5, 1, 5, C.sand)

    const b0 = new THREE.Vector3(14.8, 10.9, 0.5)
    const b2 = new THREE.Vector3(30.5, 12.0, -5.5)
    const b1 = new THREE.Vector3(22.5, 15.2, -2.4)
    const dir = b2.clone().sub(b0).normalize()
    const side = new THREE.Vector3(-dir.z, 0, dir.x)
    const N = 13
    const postsL = []
    const postsR = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const p = new THREE.Vector3()
        .addScaledVector(b0, (1 - t) * (1 - t))
        .addScaledVector(b1, 2 * (1 - t) * t)
        .addScaledVector(b2, t * t)
      vg.add(Math.round(p.x), Math.round(p.y), Math.round(p.z), i % 2 ? C.wood : C.woodDark)
      if (i % 2 === 0) {
        for (const sgn of [1, -1]) {
          const pp = new THREE.Vector3(
            Math.round(p.x + side.x * sgn * 0.75),
            Math.round(p.y) + 1,
            Math.round(p.z + side.z * sgn * 0.75)
          )
          vg.add(pp.x, pp.y, pp.z, C.woodDark, { size: 0.5 })
          if (sgn === 1) postsL.push(pp)
          else postsR.push(pp)
        }
      }
    }
    for (const arr of [postsL, postsR]) {
      for (let j = 0; j < arr.length - 1; j++) {
        const mid = arr[j].clone().add(arr[j + 1]).multiplyScalar(0.5)
        mid.y -= 0.45
        vg.add(mid.x, mid.y, mid.z, '#5A4028', { size: 0.24 })
      }
    }

    vg.build()
  }

  setPagodaTier(tier) {
    const t = Math.min(Math.max(tier, 1), 5)
    this.buildPagoda(t - 1)
  }

  setDawnExp(n) {
    const R = 7 + 2 * Math.max(0, Math.min(40, Math.floor(Number(n) || 0)))
    if (R === this.dawnR) return
    this.buildDawnIsle(R)
    if (this.isleRevealed) this.isleGroup.visible = true
  }

  setJadeExp(n) {
    const R = 8 + 2 * Math.max(0, Math.min(40, Math.floor(Number(n) || 0)))
    if (R === this.jadeR) return
    this.buildJadeIsle(R)
    if (this.jadeRevealed) this.jadeGroup.visible = true
  }

  setLotusExp(n) {
    const R = 6 + 2 * Math.max(0, Math.min(40, Math.floor(Number(n) || 0)))
    if (R === this.lotusR) return
    this.buildLotusIsle(R)
    if (this.lotusRevealed) this.lotusGroup.visible = true
  }

  setStarExp(n) {
    const e = Math.max(0, Math.min(16, Math.floor(Number(n) || 0)))
    if (e === this.starExp) return
    this.buildStarPeak(e)
    if (this.starRevealed) this.starGroup.visible = true
  }

  revealBridge(animated) {
    if (this.isleRevealed) return
    this.isleRevealed = true
    this.isleGroup.visible = true
    if (animated) {
      this.isleGroup.position.y = -22
      gsap.to(this.isleGroup.position, {
        y: 0, duration: 2.2, ease: 'back.out(1.2)',
        onComplete: () => { if (this.onBridgeRevealed) this.onBridgeRevealed() }
      })
    }
  }

  buildJadeIsle(R = 8) {
    if (!this.jadeGroup) {
      this.jadeGroup = new THREE.Group()
      this.jadeGroup.visible = false
      this.root.add(this.jadeGroup)
    }
    if (this.jadeVg) this.jadeVg.destroy()
    this.surfJade.clear()
    const vg = this.sys.group(this.jadeGroup)
    this.jadeVg = vg
    const rng = mulberry32(31416)
    const ITOP = 12, CX = -40, CZ = 14
    this.jadeR = R

    const JADE = '#A8E6C8', JADE_D = '#7CC9A8'

    for (let x = -R; x <= R; x++)
      for (let z = -R; z <= R; z++) {
        const d = Math.hypot(x, z)
        if (d > R - 0.4 + (vnoise(x * 0.5 + 7, z * 0.5 + 1, 13) - 0.5) * 2) continue
        const bottom = Math.round(ITOP - (1 - Math.min(d / R, 1) ** 2) * 5.5)
        const topCol = d < 4.2 ? JADE : GRASS[Math.floor(vnoise(x, z, 23) * 4)]
        vg.add(CX + x, ITOP, CZ + z, topCol)
        if (d >= 2.2) this.surfJade.set((CX + x) + ',' + (CZ + z), ITOP)
        vg.add(CX + x, ITOP - 1, CZ + z, C.dirtA)
        for (let yy = ITOP - 2; yy >= bottom; yy--) vg.add(CX + x, yy, CZ + z, yy < ITOP - 3 ? C.stoneDeep : C.stone)
        if (d < 4.2 && d >= 2.2) vg.add(CX + x, ITOP, CZ + z, ((x + z) & 1) ? JADE : JADE_D)
      }

    this.anchors.rabbitJade = { x: CX + 2, y: ITOP + 1.62, z: CZ + 2 }

    vg.build()
  }
  revealJade(animated) {
    if (this.jadeRevealed) return
    this.jadeRevealed = true
    this.jadeGroup.visible = true
    if (animated) {
      this.jadeGroup.position.y = -24
      gsap.to(this.jadeGroup.position, {
        y: 0, duration: 2.6, ease: 'back.out(1.15)',
        onComplete: () => { if (this.onJadeRevealed) this.onJadeRevealed() }
      })
    }
  }

  setCloudSea(on) {
    this.cloudSeaPuffs.forEach(g => (g.visible = on))
  }

  buildPeachTree(px, pz) {
    const vg = this.islandVg
    const topY = this.surfMain.get(px + ',' + pz) ?? TOP
    this.surfMain.delete(px + ',' + pz)
    const rng = mulberry32(808)

    vg.add(px, topY + 0.3, pz + 0.8, '#6E4527', { size: 0.6 })
    vg.add(px - 0.8, topY + 0.3, pz, '#6E4527', { size: 0.55 })
    vg.add(px, topY + 0.3, pz - 0.8, '#6E4527', { size: 0.55 })

    const taper = [1.05, 0.98, 0.92]
    for (let i = 0; i < 3; i++) vg.add(px, topY + 1 + i, pz, i % 2 ? '#A9714B' : '#8A5A3B', { size: taper[i] })

    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * Math.PI * 2
      const ax = Math.round(Math.cos(ang)), az = Math.round(Math.sin(ang))
      const horiz = a % 2 === 0 ? [ax, 0] : [0, az]
      vg.add(px + horiz[0], topY + 3.25, pz + horiz[1], '#8A5A3B', { size: 0.7 })
      vg.add(px + horiz[0] * 2, topY + 3.25, pz + horiz[1] * 2, '#8A5A3B', { size: 0.55 })
      vg.add(px + horiz[0] * 2, topY + 3.9, pz + horiz[1] * 2, '#6FBF73', { size: 0.6, sway: 0.5, sss: 0.7 })
    }

    const leafCols = ['#7FC96B', '#9FD88F', '#C9E89A', '#FFD9EC']
    const cy = topY + 4.9
    const canopyCells = []
    const blobs = [
      [0, 0, 0, 2.1],
      [1.3, 0.5, -0.9, 1.35],
      [-1.2, 0.4, 1.0, 1.3],
      [0.2, -0.7, 0.4, 1.2]
    ]
    for (const [bx, by, bz, br] of blobs) {
      for (let i = 0; i < 26; i++) {
        const ox = bx + (rng() * 2 - 1) * br
        const oy = by + (rng() * 2 - 1) * br * 0.6
        const oz = bz + (rng() * 2 - 1) * br
        if ((ox / 2.6) ** 2 + (oy / 1.6) ** 2 + (oz / 2.6) ** 2 > 1) continue
        const cell = [px + Math.round(ox), cy + Math.round(oy), pz + Math.round(oz), oy]
        canopyCells.push(cell)
        const r = rng()
        vg.add(cell[0], cell[1], cell[2],
          oy < -0.5 ? '#6FBF73' : leafCols[Math.floor(rng() * 4)],
          r < 0.05
            ? { glow: true, size: 0.7, sway: 0.45 }
            : { size: 0.72, sway: 0.4 + rng() * 0.4, sss: 0.75 })
      }
    }

    const lowCells = canopyCells.filter(c => c[3] < -0.2)
    const fruitSpots = []
    const used = new Set()
    for (let i = 0; i < 5 && lowCells.length; i++) {
      const c = lowCells[Math.floor(rng() * lowCells.length)]
      const k = c[0] + ',' + c[2]
      if (used.has(k)) continue
      used.add(k)
      const dx = c[0] - px, dz = c[2] - pz
      const len = Math.max(Math.hypot(dx, dz), 0.001)
      const fx = c[0] + (dx / len) * 0.28
      const fz = c[2] + (dz / len) * 0.28
      const fy = c[1] - 0.72
      vg.add(fx, fy + 0.34, fz, '#6E8F3E', { size: 0.16 })
      fruitSpots.push([fx, fy, fz])
    }

    this.peachGroup = new THREE.Group()
    this.peachMeshes = []
    const peachMats = ['#FFC98A', '#FFB36B', '#FF9E7A'].map(h =>
      new THREE.MeshBasicMaterial({ color: new THREE.Color(h).multiplyScalar(1.18), toneMapped: false })
    )
    const leafMat = new THREE.MeshLambertMaterial({ color: '#6FBF73' })
    fruitSpots.forEach((s, idx) => {
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), leafMat)
      stem.position.set(s[0], s[1] + 0.22, s[2])
      this.peachGroup.add(stem)
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.5), peachMats[idx % 3])
      m.position.set(s[0], s[1], s[2])
      m.rotation.y = idx * 0.5
      m.userData = { special: 'peach', idx }
      this.peachMeshes.push(m)
      this.peachGroup.add(m)
    })
    this.root.add(this.peachGroup)
    this.anchors.peachTree = new THREE.Vector3(px, cy, pz)
  }

  setPeachVisible(i, v) {
    const m = this.peachMeshes?.[i]
    if (m && m.visible !== v) {
      m.visible = v
      if (v) gsap.fromTo(m.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1,0.5)' })
    }
  }

  buildIncense(x, z) {
    const vg = this.islandVg
    const topY = this.surfMain.get(x + ',' + z) ?? TOP
    this.surfMain.delete(x + ',' + z)
    vg.add(x, topY + 1, z, '#7A5A42', { size: 0.95 })
    vg.add(x, topY + 2, z, '#B08D57', { size: 0.8 })
    vg.add(x, topY + 3, z, '#8F7048', { size: 0.95 })
    vg.add(x, topY + 3.45, z, '#FF9A5A', { glow: true, size: 0.42 })
    this.anchors.incense = new THREE.Vector3(x, topY + 3.6, z)
  }

  buildRings() {
    this.ringsGroup = new THREE.Group()
    this.ringsSub = []
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#FFD27A').multiplyScalar(1.15),
      toneMapped: false, transparent: true, opacity: 0.85
    })
    const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32)
    const mkRing = (rad, n, dir) => {
      const sub = new THREE.Group()
      sub.rotation.x = dir * 0.16
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const m = new THREE.Mesh(geo, mat)
        m.position.set(Math.cos(a) * rad, Math.sin(a * 2) * 0.35, Math.sin(a) * rad)
        sub.add(m)
      }
      this.ringsGroup.add(sub)
      return sub
    }
    this.ringsSub = [mkRing(7.5, 18, 1), mkRing(6, 14, -1)]
    this.ringsGroup.visible = false
    this.root.add(this.ringsGroup)
  }

  setRingsVisible(v) {
    this.ringsGroup.visible = !!v
  }

  update(dt, t) {
    for (const L of this.lanterns) {
      if (L.busy) continue
      L.ang += L.spd * dt
      L.g.position.set(
        Math.cos(L.ang) * L.rad,
        L.y + Math.sin(t * 0.7 + L.ph) * 0.7,
        Math.sin(L.ang) * L.rad
      )
      L.g.rotation.y += L.spin * dt
    }
    for (const cl of this.clouds) {
      if (cl.under) {
        cl.g.position.set(cl.x, cl.y + Math.sin(t * 0.3 + cl.ph) * 0.4, 0)
        cl.g.position.x = cl.x + Math.sin(t * 0.05 + cl.ph) * 2
      } else {
        cl.ang += cl.spd * dt
        cl.g.position.set(Math.cos(cl.ang) * cl.rad, cl.y, Math.sin(cl.ang) * cl.rad)
      }
    }
    if (this.waterMat) {
      this.waterMat.opacity = 0.63 + Math.sin(t * 1.2) * 0.04
    }
    if (this.ringsGroup && this.ringsGroup.visible) {
      this.ringsGroup.position.set(0, this.anchors.pagodaTop.y - 6, 0)
      this.ringsSub[0].rotation.y += dt * 0.35
      this.ringsSub[1].rotation.y -= dt * 0.28
    }
    if (this.dockBobs) {
      for (const b of this.dockBobs) {
        b.orb.position.y = b.baseY + Math.sin(t * 2 + b.ph) * 0.12
      }
    }
  }

  dispose() {
    this.islandVg.destroy()
    if (this.pagodaVg) this.pagodaVg.destroy()
    this.isleVg.destroy()
    if (this.jadeVg) this.jadeVg.destroy()
    if (this.water) { this.water.geometry.dispose(); this.root.remove(this.water) }
  }
}
