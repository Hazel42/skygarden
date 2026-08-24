import * as THREE from 'three'
import gsap from 'gsap'
import { C } from './palette.js'
import { mulberry32, vnoise, VoxelGroup } from './voxel.js'

export const TOP = 10
export const ISLE_R = 15
export const POND = { x: -4.5, z: -3.5, r: 4.3 }

const WALLS = [7, 5, 5, 3, 3, 3, 3]
const GRASS = [C.grassA, C.grassB, C.grassC, C.grassA, C.grassD]

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
    this.buildIsland()
    this.buildWater()
    this.buildFloatingLanterns()
    this.buildClouds()
    this.buildPagoda(0)
    for (let x = -5; x <= 5; x++)
      for (let z = -5; z <= 5; z++) this.surfMain.delete(x + ',' + z)
    this.buildDawnIsle()
    this.buildJadeIsle()
    this.buildPeachTree(-11, 4)
    this.buildIncense(3, 7)
    this.buildRings()
    this.buildLotusIsle()
    this.buildStarPeak()
    this.buildDockProps()
  }

  buildLotusIsle(animatedGroup = true) {
    if (!this.lotusGroup) {
      this.lotusGroup = new THREE.Group()
      this.lotusGroup.visible = false
      this.root.add(this.lotusGroup)
    }
    const vg = this.sys.group(this.lotusGroup)
    this.lotusVg = vg
    const rng = mulberry32(60606)
    const ITOP = 9, R = 6, CX = -24, CZ = 24

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
            for (let yy = bottom; yy <= ITOP - 3; yy++) vg.add(CX + x, yy, CZ + z, C.stoneDeep)
          }
        } else {
          vg.add(CX + x, ITOP, CZ + z, GRASS[Math.floor(vnoise(x, z, 24) * 4)])
          this.surfLotus.set((CX + x) + ',' + (CZ + z), ITOP)
          vg.add(CX + x, ITOP - 1, CZ + z, C.dirtA)
          for (let yy = ITOP - 2; yy >= bottom; yy--) vg.add(CX + x, yy, CZ + z, C.stone)
        }
      }

    vg.add(CX - 1, ITOP + 0.9, CZ, C.lotusLeaf, { size: 1 })
    vg.add(CX + 1, ITOP + 0.9, CZ - 1, C.lotusLeaf, { size: 0.85 })
    for (const [ox, oz] of [[0, 0.28], [0, -0.28], [0.28, 0], [-0.28, 0]])
      vg.add(CX - 1 + ox, ITOP + 1.25, CZ + oz, C.lotusFlower, { size: 0.45 })
    vg.add(CX - 1, ITOP + 1.6, CZ, C.gold, { glow: true, size: 0.36 })
    vg.add(CX + 1.4, ITOP + 1.15, CZ + 1.2, '#FFC0DB', { glow: true, size: 0.4 })

    this.lotusWater = new THREE.Mesh(
      new THREE.CircleGeometry(2.35, 24),
      new THREE.MeshPhongMaterial({ color: C.water, transparent: true, opacity: 0.66, shininess: 110, specular: '#CFEFFF' })
    )
    this.lotusWater.rotation.x = -Math.PI / 2
    this.lotusWater.position.set(CX, ITOP - 0.15, CZ)
    this.lotusGroup.add(this.lotusWater)

    this.makeTreeOn(vg, CX - 3, CZ - 3, ITOP, 4, 1.8)

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
    this.lotusRevealed = false
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

  buildStarPeak() {
    if (!this.starGroup) {
      this.starGroup = new THREE.Group()
      this.starGroup.visible = false
      this.root.add(this.starGroup)
    }
    const vg = this.sys.group(this.starGroup)
    this.starVg = vg
    const rng = mulberry32(70707)
    const SX = 36, SZ = -27
    const SUMMIT = 21

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
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++) {
        vg.add(SX + x, SUMMIT + 1, SZ + z, GRASS[Math.floor(vnoise(x, z, 35) * 4)])
        this.surfStar.set((SX + x) + ',' + (SZ + z), SUMMIT + 1)
      }

    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      for (let hgt = 2; hgt <= 4; hgt++)
        vg.add(SX + ox, SUMMIT + hgt, SZ + oz, '#F7EDDE', { size: 0.42 })
    for (let rw = 5; rw >= 1; rw -= 2) {
      const hw = Math.floor(rw / 2)
      const ry = SUMMIT + 5 + (5 - rw) / 2
      for (let x = -hw; x <= hw; x++)
        for (let z = -hw; z <= hw; z++) {
          const outer = Math.abs(x) === hw || Math.abs(z) === hw
          vg.add(SX + x, ry, SZ + z, outer ? C.gold : ((((x + z) & 1) ? C.roofA : C.roofB)), { size: 0.95 })
        }
    }
    vg.add(SX, SUMMIT + 8, SZ, '#FFF0B8', { glow: true, size: 0.85 })
    vg.add(SX, SUMMIT + 7, SZ, C.gold, { size: 0.5 })

    for (let i = 0; i < 8; i++) {
      const a = rng() * Math.PI * 2, rr = rng() * 1.2
      vg.add(SX + Math.round(Math.cos(a) * rr), SUMMIT + 1.68, SZ + Math.round(Math.sin(a) * rr),
        rng() < 0.5 ? '#FFF0B8' : '#C9A7FF', { glow: true, size: 0.3 })
    }
    this.anchors.trees.push({ x: SX, y: SUMMIT + 2, z: SZ, rad: 2 })

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
    this.starRevealed = false
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
        rng() < 0.08 ? { glow: true, size: 0.5 } : { size: 0.58 })
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
      this.dockBobs.push({ orb, baseY: 2.45, ph: x + z })
      this.anchors['dock_' + key] = new THREE.Vector3(x, g.position.y + 2.4, z)
    }

    mkSign(4, 9, 'upgrades', '#FFC9DC')
    mkCrate(-4, 9, 'build', '#A8E8DC')
    mkBoard(2, 12, 'quests', '#FFF0B8')
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

  buildIsland() {
    const vg = this.islandVg
    const rng = this.rng
    const R = ISLE_R

    for (let x = -R; x <= R; x++) {
      for (let z = -R; z <= R; z++) {
        const d = Math.hypot(x, z)
        const edge = R - 0.6 + (vnoise(x * 0.45 + 9, z * 0.45, 5) - 0.5) * 2.6
        if (d > edge) continue

        const bump = Math.round(vnoise(x * 0.35, z * 0.35, 7) * 1.8 - 0.9)
        const topY = d < 7.5 ? TOP : TOP + bump
        const bottom = Math.round(TOP - (1 - Math.min(d / R, 1) ** 2) * 7.5 - vnoise(x * 0.6, z * 0.6, 11) * 2)

        const pd = Math.hypot(x - POND.x, z - POND.z)
        const pr = POND.r + (vnoise(x * 0.5, z * 0.5, 3) - 0.5) * 1.3
        const inChannel = x <= -9 && x >= -13 && (z === -4 || z === -3) && x <= Math.floor(edge) - 1

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

        const onPathS = Math.abs(x) <= 1 && z >= 6 && z <= 8 && topY === TOP
        const onPathE = z >= 0 && z <= 1 && x >= 10 && x <= 15 && topY === TOP
        const steps = (x === 0 && (z === 10 || z === 12))
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
    for (let i = 0; i < 300; i++) {
      const a = tuftRng() * Math.PI * 2
      const rr = Math.sqrt(tuftRng()) * (ISLE_R - 2)
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr
      const d = Math.hypot(x, z)
      if (d < 7.5) continue
      const pd = Math.hypot(x - POND.x, z - POND.z)
      if (pd < POND.r + 1.2) continue
      if (x <= -8 && z >= -5 && z <= -2) continue
      const bump = Math.round(vnoise(x * 0.35, z * 0.35, 7) * 1.8 - 0.9)
      const topY = TOP + bump
      if (tuftRng() < 0.68) {
        vg.add(x, topY + 0.68, z, tuftRng() < 0.5 ? C.grassD : C.bambooLight, { size: 0.3 })
      } else {
        const fc = ['#FF9EC0', '#FFF3A6', '#FFFFFF', '#C9A7FF'][Math.floor(tuftRng() * 4)]
        vg.add(x, topY + 0.7, z, fc, { size: 0.34 })
      }
    }

    this.makeTree(7, -6, 5, 2.9)
    this.makeTree(-9, 3, 6, 3.3)
    this.makeTree(-2, 9, 4, 2.6)
    this.makeTree(10, 4, 5, 3.0)
    this.makeTree(-11, -6, 5, 2.7)

    this.makeBamboo(12, -9)
    this.makeBamboo(-13, 7)
    this.makeBamboo(6, -12)

    this.makeStone(5, 4, true)
    this.makeStone(-6, -8, false)
    this.makeStone(11, -3, false)
    this.makeStone(-3, 12, false)

    this.makeToro(3, 9)
    this.makeToro(-8, -9)

    this.makeLotus()

    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2
      const rr = rng() * 2.6
      vg.add(Math.cos(a) * rr, 1.5 + Math.floor(rng() * 3), Math.sin(a) * rr,
        rng() < 0.6 ? C.crystalA : C.crystalB, { glow: true, size: 0.55 + rng() * 0.45 })
    }

    vg.build()
  }

  makeTree(tx, tz, h, rad) {
    const vg = this.islandVg
    const rng = mulberry32(tx * 31 + tz * 17 + 5)
    const baseY = TOP + 1
    for (let i = 0; i < h; i++) vg.add(tx, baseY + i, tz, i % 2 ? C.wood : C.woodDark)
    vg.add(tx + 1, baseY + h - 1, tz, C.woodDark)
    vg.add(tx, baseY + h, tz + (rng() < 0.5 ? 1 : -1), C.wood)

    const cy = baseY + h + 1
    const cols = [C.blossomA, C.blossomB, C.blossomC]
    for (let i = 0; i < 46; i++) {
      let ox = (rng() * 2 - 1) * rad
      let oy = (rng() * 2 - 1) * (rad * 0.62)
      let oz = (rng() * 2 - 1) * rad
      if ((ox / rad) ** 2 + (oy / (rad * 0.7)) ** 2 + (oz / rad) ** 2 > 1) continue
      const px = tx + Math.round(ox), py = cy + Math.round(oy), pz = tz + Math.round(oz)
      const shade = cols[Math.floor(rng() * 3)]
      if (rng() < 0.075) vg.add(px, py, pz, C.blossomGlow, { glow: true })
      else vg.add(px, py, pz, oy < -rad * 0.3 ? C.blossomB : shade)
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
      if (d < 7.5 || d > ISLE_R - 1) continue
      const h = 5 + Math.floor(rng() * 3)
      for (let i = 0; i < h; i++)
        vg.add(x, TOP + 1 + i, z, i % 3 === 2 ? C.bambooLight : C.bamboo, { size: 0.42 })
      vg.add(x + 1, TOP + h, z, C.bambooLight, { size: 0.36 })
      vg.add(x - 1, TOP + h - 1, z, C.bambooLight, { size: 0.36 })
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
          const mossy = l === lv - 1 && rng() < 0.65
          vg.add(sx + i, TOP + 1 + l, sz + j, mossy ? C.moss : (rng() < 0.5 ? C.stone : C.stoneDeep))
        }
    }
  }

  makeToro(px, pz) {
    const vg = this.islandVg
    vg.add(px, TOP + 1, pz, C.stoneDeep, { size: 1 })
    vg.add(px, TOP + 2, pz, C.stone, { size: 0.7 })
    vg.add(px, TOP + 3, pz, '#FFE2A8', { win: true })
    vg.add(px, TOP + 4, pz, C.stoneDeep, { size: 0.9 })
    vg.add(px, TOP + 5, pz, C.stone, { size: 0.5 })
    this.anchors.toroLights.push(new THREE.Vector3(px, TOP + 3, pz))
  }

  makeLotus() {
    const vg = this.islandVg
    const rng = mulberry32(4242)
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2
      const rr = rng() * (POND.r - 1.8)
      const x = Math.round(POND.x + Math.cos(a) * rr)
      const z = Math.round(POND.z + Math.sin(a) * rr)
      vg.add(x, 9.92, z, C.lotusLeaf, { size: 0.85 })
    }
    const spots = [[-4, -3], [-6, -4.5], [-3, -5.5]]
    for (const [fx, fz] of spots) {
      vg.add(fx, 9.9, fz, C.lotusLeaf, { size: 1 })
      const petals = [[0, 0, 0.55], [0, 0, -0.55], [0.55, 0, 0], [-0.55, 0, 0]]
      for (const [ox, , oz] of petals) vg.add(fx + ox, 10.25, fz + oz, C.lotusFlower, { size: 0.42 })
      vg.add(fx, 10.5, fz, C.gold, { glow: true, size: 0.34 })
    }
  }

  buildWater() {
    const geo = new THREE.CircleGeometry(POND.r - 0.55, 30)
    this.waterMat = new THREE.MeshPhongMaterial({
      color: C.water, transparent: true, opacity: 0.66,
      shininess: 110, specular: '#CFEFFF'
    })
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
        spin: 0.2 + rng() * 0.3
      }
      this.lanterns.push(rec)
      this.root.add(g)
    }
    this.setLanternCount(5)
  }

  setLanternCount(n) {
    this.lanterns.forEach((L, i) => (L.g.visible = i < n))
  }

  buildClouds() {
    const rng = mulberry32(555)
    const mat = new THREE.MeshLambertMaterial({ color: C.cloud })
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const makePuff = () => {
      const g = new THREE.Group()
      const n = 7 + Math.floor(rng() * 6)
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, mat)
        m.position.set((rng() * 2 - 1) * 3.2, (rng() * 2 - 1) * 1.1, (rng() * 2 - 1) * 1.8)
        m.scale.setScalar(0.8 + rng() * 1.6)
        m.scale.y *= 0.6
        g.add(m)
      }
      return g
    }
    for (let i = 0; i < 4; i++) {
      const rec = {
        g: makePuff(), ang: rng() * Math.PI * 2,
        rad: 24 + rng() * 7, y: 7 + rng() * 11,
        spd: 0.01 + rng() * 0.014, under: false
      }
      this.clouds.push(rec)
      this.root.add(rec.g)
    }
    for (let i = 0; i < 2; i++) {
      const rec = { g: makePuff(), x: (i ? 6 : -5), y: -2.5 - i, spd: 0, under: true, ph: rng() * 6 }
      this.clouds.push(rec)
      this.root.add(rec.g)
    }
    for (let i = 0; i < 6; i++) {
      const rec = {
        g: makePuff(), ang: rng() * Math.PI * 2,
        rad: 18 + rng() * 10, y: 1.5 + rng() * 4,
        spd: 0.008 + rng() * 0.012, under: false
      }
      rec.g.visible = false
      this.cloudSeaPuffs.push(rec.g)
      this.clouds.push(rec)
      this.root.add(rec.g)
    }
    this.clouds.forEach(c => { if (!c.under) c.g.scale.multiplyScalar(c.y < 6 ? 1.5 : 1) })
  }

  buildPagoda(tier) {
    if (this.pagodaVg) this.pagodaVg.destroy()
    const vg = this.sys.group(this.root)
    this.pagodaVg = vg

    vg.box(-5, TOP, -5, 11, 1, 11, C.stone)
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
      y++
      rw -= 2
    }
    return y
  }

  buildDawnIsle() {
    const vg = this.sys.group(this.isleGroup)
    this.isleVg = vg
    const rng = mulberry32(2024)
    const ITOP = 11, R = 7, CX = 34, CZ = -6

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

    const px = CX, pz = CZ
    for (const dz of [-2, 2]) {
      for (let i = 0; i < 4; i++) vg.add(px, ITOP + 1 + i, pz + dz, i < 3 ? C.torii : C.toriiDark)
    }
    vg.box(px - 2, ITOP + 4, pz - 2, 1, 1, 5, C.torii)
    vg.box(px, ITOP + 4, pz - 1, 1, 1, 3, C.torii)
    vg.box(px - 1, ITOP + 5, pz - 2, 3, 1, 5, C.toriiDark)
    vg.add(px, ITOP + 6, pz, C.gold, { glow: true, size: 0.5 })

    vg.add(CX + 3, ITOP + 1, CZ, C.stone, { size: 1 })
    vg.add(CX + 3, ITOP + 1, CZ - 1, C.stone, { size: 1 })

    const tx = CX - 3, tz = CZ + 3
    for (let i = 0; i < 4; i++) vg.add(tx, ITOP + 1 + i, tz, i % 2 ? C.wood : C.woodDark)
    const cols = [C.blossomA, C.blossomB, C.blossomC]
    for (let i = 0; i < 26; i++) {
      const ox = (rng() * 2 - 1) * 1.9, oz = (rng() * 2 - 1) * 1.9, oy = (rng() * 2 - 1) * 1.1
      if ((ox / 2.2) ** 2 + (oy / 1.4) ** 2 + (oz / 2.2) ** 2 > 1) continue
      vg.add(tx + Math.round(ox), ITOP + 5 + Math.round(oy), tz + Math.round(oz),
        rng() < 0.08 ? C.blossomGlow : cols[Math.floor(rng() * 3)],
        rng() < 0.08 ? { glow: true } : {})
    }
    this.anchors.trees.push({ x: tx, y: ITOP + 6, z: tz, rad: 2.2 })

    const b0 = new THREE.Vector3(14.8, 10.9, 0.5)
    const b2 = new THREE.Vector3(30.5, 12.0, -5.5)
    const b1 = new THREE.Vector3(22.5, 15.2, -2.4)
    const dir = b2.clone().sub(b0).normalize()
    const side = new THREE.Vector3(-dir.z, 0, dir.x)
    const N = 13
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const p = new THREE.Vector3()
        .addScaledVector(b0, (1 - t) * (1 - t))
        .addScaledVector(b1, 2 * (1 - t) * t)
        .addScaledVector(b2, t * t)
      vg.add(Math.round(p.x), Math.round(p.y), Math.round(p.z), i % 2 ? C.wood : C.woodDark)
      if (i % 2 === 0) {
        for (const sgn of [1, -1]) {
          vg.add(Math.round(p.x + side.x * sgn), Math.round(p.y) + 1, Math.round(p.z + side.z * sgn),
            C.woodDark, { size: 0.5 })
        }
      }
    }

    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * (R - 1.5)
      const x = CX + Math.cos(a) * rr, z = CZ + Math.sin(a) * rr
      if (Math.abs(x - CX) <= 2 && Math.abs(z - CZ) <= 2) continue
      if (rng() < 0.6) vg.add(x, ITOP + 0.68, z, C.grassD, { size: 0.3 })
      else vg.add(x, ITOP + 0.7, z, '#FF9EC0', { size: 0.32 })
    }

    vg.build()
  }

  setPagodaTier(tier) {
    this.buildPagoda(Math.min(tier, 4))
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

  buildJadeIsle() {
    if (!this.jadeGroup) {
      this.jadeGroup = new THREE.Group()
      this.jadeGroup.visible = false
      this.root.add(this.jadeGroup)
    }
    const vg = this.sys.group(this.jadeGroup)
    this.jadeVg = vg
    const rng = mulberry32(31416)
    const ITOP = 12, R = 8, CX = -40, CZ = 14

    const JADE = '#A8E6C8', JADE_D = '#7CC9A8', ROOF_J = '#4FB8A8'

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

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const px = CX + Math.round(Math.cos(a) * 3), pz = CZ + Math.round(Math.sin(a) * 3)
      for (let hgt = 1; hgt <= 4; hgt++) vg.add(px, ITOP + hgt, pz, hgt === 4 ? JADE_D : JADE)
    }
    for (let rw = 9; rw >= 3; rw -= 2) {
      const hw = Math.floor(rw / 2)
      const ry = ITOP + 5 + (9 - rw) / 2
      for (let x = -hw; x <= hw; x++)
        for (let z = -hw; z <= hw; z++) {
          const outer = Math.abs(x) === hw || Math.abs(z) === hw
          vg.add(CX + x, ry, CZ + z, outer ? C.trim : (((x + z) & 1) ? ROOF_J : '#66C9B8'))
        }
    }
    vg.add(CX, ITOP + 9, CZ, C.gold, { glow: true, size: 0.9 })

    for (const [ox, oz] of [[-5, -4], [5, 3], [-4, 5], [6, -5]]) {
      vg.add(CX + ox, ITOP + 1.6, CZ + oz, '#CFE0FF', { glow: true, size: 0.55 })
      vg.add(CX + ox, ITOP + 1, CZ + oz, C.stoneDeep, { size: 0.7 })
    }
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, rr = 4.5 + rng() * 2.6
      const x = CX + Math.round(Math.cos(a) * rr), z = CZ + Math.round(Math.sin(a) * rr)
      if (!this.surfJade.has(x + ',' + z)) continue
      if (rng() < 0.5) vg.add(x, ITOP + 0.68, z, '#BFFFE0', { size: 0.3 })
      else vg.add(x, ITOP + 0.72, z, '#FFF0B8', { glow: true, size: 0.32 })
    }
    vg.add(CX + 2, ITOP + 1, CZ + 2, '#FFE9F2', { size: 0.95 })
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
    for (let i = 1; i <= 3; i++) vg.add(px, topY + i, pz, i % 2 ? '#8A5A3B' : '#A9714B', { size: 0.9 })
    vg.add(px + 1, topY + 3, pz, '#8A5A3B', { size: 0.6 })
    vg.add(px - 1, topY + 3.4, pz, '#8A5A3B', { size: 0.6 })
    const leafCols = ['#9FD88F', '#C9E89A', '#B7DF9E']
    const rng = mulberry32(808)
    for (let i = 0; i < 30; i++) {
      const ox = (rng() * 2 - 1) * 2, oy = (rng() * 2 - 1) * 1.2, oz = (rng() * 2 - 1) * 2
      if ((ox / 2.3) ** 2 + (oy / 1.5) ** 2 + (oz / 2.3) ** 2 > 1) continue
      vg.add(px + Math.round(ox), topY + 4.6 + Math.round(oy), pz + Math.round(oz),
        leafCols[Math.floor(rng() * 3)], { size: 0.75 })
    }
    this.peachGroup = new THREE.Group()
    this.peachMeshes = []
    const peachMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#FFC98A').multiplyScalar(1.25), toneMapped: false
    })
    const spots = [[-0.9, 4.2, 0.7], [0.8, 4.6, -0.6], [0.1, 5.4, 1.1], [-0.5, 5.1, -1.2], [1.2, 5.2, 0.9]]
    spots.forEach((s, idx) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), peachMat)
      m.position.set(px + s[0], topY + s[1], pz + s[2])
      m.userData = { special: 'peach', idx }
      this.peachMeshes.push(m)
      this.peachGroup.add(m)
    })
    this.root.add(this.peachGroup)
    this.anchors.peachTree = new THREE.Vector3(px, topY + 4.5, pz)
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
  }
}
