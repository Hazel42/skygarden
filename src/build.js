import * as THREE from 'three'
import gsap from 'gsap'
import { buildVoxelGeometry, createVoxelSolidMaterial } from './voxel.js'

const CATALOG_DEF = [
  {
    id: 'star', icon: '✨', name: 'Starbloom', cost: 15, zone: 'land', minLv: 1,
    fn(add) {
      add(0, 1, 0, '#6FBF73', { size: 0.32, sway: 0.9 })
      add(0, 1.55, 0, '#FFF0B8', { glow: true, size: 0.42 })
    }
  },
  {
    id: 'rock', icon: '🪨', name: 'Garden Rock', cost: 25, zone: 'land', minLv: 1,
    fn(add) {
      add(0, 1, 0, '#98A1AB')
      add(0, 2, 0, '#8A939D', { size: 0.85 })
      add(0, 2.75, 0, '#7FB069', { size: 0.55 })
      add(1, 1, 0, '#8A939D', { size: 0.7 })
      add(-0.6, 1.35, 0.4, '#7FB069', { size: 0.4 })
    }
  },
  {
    id: 'sapling', icon: '🌸', name: 'Cherry Sapling', cost: 40, zone: 'land', minLv: 1,
    fn(add) {
      add(0, 1, 0, '#855536', { size: 0.6 })
      add(0, 2, 0, '#A9714B', { size: 0.55 })
      const cols = ['#FFC9DC', '#FFB3CE', '#FFDDEC']
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        const rr = 0.9 + (i % 3) * 0.25
        add(Math.cos(a) * rr, 2.6 + (i % 4) * 0.45, Math.sin(a) * rr,
          cols[i % 3], { size: 0.62, sway: 0.5 + (i % 3) * 0.2, sss: 0.85 })
      }
      add(0, 3.4, 0, '#FFD4E8', { glow: true, size: 0.5 })
    }
  },
  {
    id: 'bamboo', icon: '🎋', name: 'Bamboo Cluster', cost: 60, zone: 'land', minLv: 2,
    fn(add) {
      for (const [ox, oz, h] of [[-0.5, -0.3, 5], [0.4, 0.3, 6], [0, -0.6, 4]]) {
        for (let y = 1; y <= h; y++)
          add(ox, y, oz, y % 3 === 0 ? '#AFDF9A' : '#8FC97F', { size: 0.42, sway: 0.22 })
        add(ox + 0.5, h + 0.6, oz, '#AFDF9A', { size: 0.36, sway: 0.75, sss: 0.6 })
      }
    }
  },
  {
    id: 'lantern', icon: '🏮', name: 'Stone Lantern', cost: 120, zone: 'land', minLv: 2,
    fn(add) {
      add(0, 1, 0, '#7E8791')
      add(0, 2, 0, '#98A1AB', { size: 0.7 })
      add(0, 3, 0, '#FFE2A8', { win: true })
      add(0, 4, 0, '#7E8791', { size: 0.95 })
      add(0, 4.8, 0, '#98A1AB', { size: 0.5 })
    }
  },
  {
    id: 'lotus', icon: '🪷', name: 'Lotus Bloom', cost: 150, zone: 'water', minLv: 2,
    fn(add) {
      add(0, 1, 0, '#6FBF73', { size: 0.95 })
      for (const [ox, oz] of [[0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]])
        add(ox, 1.32, oz, '#FFC0DB', { size: 0.4 })
      add(0, 1.62, 0, '#FFD27A', { glow: true, size: 0.34 })
    }
  },
  {
    id: 'crystal', icon: '💠', name: 'Moon Crystal', cost: 300, zone: 'land', minLv: 3,
    fn(add) {
      add(0, 1.4, 0, '#C9A7FF', { glow: true, size: 0.65 })
      add(0.5, 1, 0.2, '#9FD8FF', { glow: true, size: 0.5 })
      add(-0.45, 1.1, -0.3, '#C9A7FF', { glow: true, size: 0.55 })
      add(0, 0.7, 0, '#7E8791', { size: 0.8 })
    }
  },
  {
    id: 'torii', icon: '⛩️', name: 'Mini Torii', cost: 600, zone: 'land', minLv: 3,
    fn(add) {
      for (const dz of [-1, 1])
        for (let y = 1; y <= 3; y++) add(0, y, dz, y === 3 ? '#C75454' : '#E56B6F')
      for (let x = -1; x <= 1; x++) {
        add(x, 3.6, 0, '#E56B6F', { size: 0.85 })
        add(x, 4.4, 0, '#C75454', { size: 0.85 })
      }
      add(0, 5.1, 0, '#FFD27A', { glow: true, size: 0.4 })
    }
  },
  {
    id: 'shrine', icon: '🛕', name: 'Forest Shrine', cost: 1200, zone: 'land', minLv: 4,
    fn(add) {
      for (let x = -1; x <= 1; x++)
        for (let z = -1; z <= 1; z++) add(x, 1, z, '#98A1AB', { size: 0.96 })
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        for (let y = 2; y <= 3; y++) add(cx, y, cz, '#855536', { size: 0.5 })
      add(0, 2.6, 0, '#FFE2A8', { win: true })
      for (let rw = 5; rw >= 1; rw -= 2) {
        const hw = Math.floor(rw / 2)
        const ry = 4 + (5 - rw) / 2
        for (let x = -hw; x <= hw; x++)
          for (let z = -hw; z <= hw; z++) {
            const outer = Math.abs(x) === hw || Math.abs(z) === hw
            add(x, ry, z, (rw === 5 && outer) ? '#FBF0DC' : ((((x + z) & 1) === 0) ? '#EE7B7B' : '#F4938F'), { size: 0.96 })
          }
      }
      add(0, 6.4, 0, '#FFD27A', { glow: true, size: 0.4 })
    }
  }
]

export class Builder {
  constructor(scene, world, state, hooks = {}) {
    this.scene = scene
    this.world = world
    this.state = state
    this.hooks = hooks

    this.solidMat = createVoxelSolidMaterial()
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    this.ghostOk = new THREE.MeshBasicMaterial({
      color: '#7FD88F', transparent: true, opacity: 0.5,
      depthWrite: false, toneMapped: false
    })
    this.ghostBad = new THREE.MeshBasicMaterial({
      color: '#FF8A8A', transparent: true, opacity: 0.5,
      depthWrite: false, toneMapped: false
    })

    this.templates = new Map()
    for (const item of CATALOG_DEF) {
      const list = []
      item.fn((x, y, z, c, o) => list.push({
        x, y, z, c, s: o?.s ?? o?.size ?? 1,
        glow: !!o?.glow, win: !!o?.win,
        sway: o?.sway ?? 0, sss: o?.sss ?? 0
      }))
      const occ = new Map(list.map(v => [v.x + ',' + v.y + ',' + v.z, v]))
      this.templates.set(item.id, {
        solid: buildVoxelGeometry(list.filter(v => !v.glow && !v.win), { ao: true, occupancy: occ }),
        glow: buildVoxelGeometry(list.filter(v => v.glow || v.win), { ao: false, flat: true, occupancy: occ })
      })
    }

    this.placedRoot = new THREE.Group()
    scene.add(this.placedRoot)
    this.occupancy = new Set()
    this.placedGroups = new Map()

    this.active = false
    this.selected = null
    this.mode = 'place'
    this.rot = 0
    this.ghost = null
    this._lastValid = false
    this._lastCell = null
  }

  get catalog() { return CATALOG_DEF }

  slotsLeft() { return Math.max(0, this.state.slots() - this.state.placements.length) }

  select(id) {
    this.exitGhost()
    this.active = !!id
    this.selected = id
    this.mode = 'place'
    this.rot = 0
    if (id) this.makeGhost(id)
    return this.active
  }

  setMode(m) {
    this.mode = m
    if (m !== 'place' && this.ghost) this.ghost.visible = false
  }

  rotate() {
    this.rot = (this.rot + 1) % 4
    if (this.ghost) this.ghost.rotation.y = this.rot * Math.PI / 2
  }

  exitGhost() {
    if (this.ghost) {
      this.scene.remove(this.ghost)
      this.ghost = null
    }
  }

  makeGhost(id) {
    const tpl = this.templates.get(id)
    if (!tpl) return
    const g = new THREE.Group()
    if (tpl.solid) g.add(new THREE.Mesh(tpl.solid, this.ghostOk))
    if (tpl.glow) g.add(new THREE.Mesh(tpl.glow, this.ghostOk))
    g.rotation.y = this.rot * Math.PI / 2
    g.visible = false
    this.ghost = g
    this.scene.add(g)
  }

  _pk(prefix, x, z) { return prefix + ':' + x + ',' + z }

  handlePointer(cx, cy, camera, raycaster, commit) {
    if (!this.active && this.mode !== 'remove') return
    const ndc = new THREE.Vector2(
      (cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1
    )
    raycaster.setFromCamera(ndc, camera)

    if (this.mode === 'remove') {
      if (this.ghost) this.ghost.visible = false
      if (!commit) return
      const hits = raycaster.intersectObjects(this.placedRoot.children, true)
      if (!hits.length) return
      let o = hits[0].object
      while (o.parent && o.parent !== this.placedRoot) o = o.parent
      this.remove(o)
      return
    }

    const hits = raycaster.intersectObjects(this.world.groundTargets(), false)
    let pos = null, valid = false
    const item = this.catalog.find(c => c.id === this.selected)

    if (hits.length) {
      const p = hits[0].point
      const x = Math.round(p.x), z = Math.round(p.z)
      const hitWater = hits[0].object === this.world.water || hits[0].object === this.world.lotusWater
      let info = hitWater ? { kind: 'water', top: 9.74, prefix: '' } : this.world.cellAt(x, z)
      if (info && info.kind === item.zone) {
        if (info.kind === 'land') {
          const pk = this._pk(info.prefix, x, z)
          const isleOk = (info.prefix !== 'D' || this.world.isleRevealed) &&
            (info.prefix !== 'L' || this.world.lotusRevealed) &&
            (info.prefix !== 'S' || this.world.starRevealed)
          valid = isleOk && !this.occupancy.has(pk) && this.slotsLeft() > 0
          pos = { x, z, pk, prefix: info.prefix, y: info.top }
        } else {
          if (this.world.waterCells.has(x + ',' + z)) {
            const onMainPond = Math.hypot(x - -4.5, z - -3.5) < 6
            const pk = this._pk('', x, z)
            valid = !this.occupancy.has(pk) && this.slotsLeft() > 0
            pos = { x, z, pk, prefix: '', y: onMainPond ? 8.9 : 8.15 }
          }
        }
      }
    }

    if (pos) {
      this.ghost.position.set(pos.x, pos.y, pos.z)
      this.ghost.rotation.y = this.rot * Math.PI / 2
      this.ghost.visible = true
      const mat = valid ? this.ghostOk : this.ghostBad
      this.ghost.children.forEach(m => (m.material = mat))
    } else if (this.ghost) {
      this.ghost.visible = false
    }
    this._lastValid = valid
    this._lastCell = pos

    if (commit && valid && pos) this.place(this.selected, pos)
  }

  place(typeId, cell, silent = false, rotOverride = null, record = true) {
    const item = this.catalog.find(c => c.id === typeId)
    if (!item) return
    const tpl = this.templates.get(typeId)
    const g = new THREE.Group()
    if (tpl.solid) g.add(new THREE.Mesh(tpl.solid, this.solidMat))
    if (tpl.glow) g.add(new THREE.Mesh(tpl.glow, this.glowMat))
    const rot = rotOverride !== null ? rotOverride : this.rot
    g.position.set(cell.x, cell.y, cell.z)
    g.rotation.y = rot * Math.PI / 2
    g.userData = { ck: cell.pk, type: typeId }
    this.placedRoot.add(g)
    this.occupancy.add(cell.pk)
    this.placedGroups.set(cell.pk, g)
    if (record) {
      this.state.placements.push({ t: typeId, x: cell.x, z: cell.z, r: rot, p: cell.prefix })
    }
    if (!silent) {
      gsap.fromTo(g.scale, { x: 0.05, y: 0.05, z: 0.05 }, {
        x: 1, y: 1, z: 1, duration: 0.55, ease: 'elastic.out(1, 0.55)'
      })
      if (this.hooks.onPlaced) this.hooks.onPlaced(item, g.position)
    }
  }

  remove(groupObj) {
    const { ck, type } = groupObj.userData
    const item = this.catalog.find(c => c.id === type)
    this.placedRoot.remove(groupObj)
    this.occupancy.delete(ck)
    this.placedGroups.delete(ck)
    const idx = this.state.placements.findIndex(p => this._pk(p.p || '', p.x, p.z) === ck)
    if (idx >= 0) this.state.placements.splice(idx, 1)
    if (item && this.hooks.onRemoved) this.hooks.onRemoved(item, groupObj.position)
  }

  loadList(arr) {
    for (const d of arr) {
      const pfx = d.p || ''
      if ((pfx === 'J' && !this.world.jadeRevealed) ||
        (pfx === 'D' && !this.world.isleRevealed) ||
        (pfx === 'L' && !this.world.lotusRevealed) ||
        (pfx === 'S' && !this.world.starRevealed)) continue
      const pk = this._pk(pfx, d.x, d.z)
      if (d.t === 'lotus' && this.world.waterCells.has(d.x + ',' + d.z)) {
        this.place(d.t, { x: d.x, z: d.z, pk, prefix: pfx, y: 8.9 }, true, d.r | 0)
      } else {
        const info = this.world.cellAt(d.x, d.z)
        if (!info || info.kind !== 'land') continue
        this.place(d.t, { x: d.x, z: d.z, pk, prefix: pfx, y: info.top }, true, d.r | 0)
      }
    }
  }
}
