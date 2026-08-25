import * as THREE from 'three'
import gsap from 'gsap'
import { buildVoxelGeometry, createVoxelSolidMaterial } from './voxel.js'
import { parseVox } from './voxloader.js'

export const VOXEL_MATS = {
  grass: { color: '#7FB069', transparent: false },
  stone: { color: '#98A1AB', transparent: false },
  wood: { color: '#8A5A3B', transparent: false },
  sand: { color: '#E8D5A3', transparent: false },
  water: { color: '#4FC3F7', transparent: true, opacity: 0.65 },
  glow: { color: '#FFE2A8', transparent: false, emissive: true }
}
const MAT_KEYS = Object.keys(VOXEL_MATS)

const CATALOG_URL = '/models/store/catalog.json'

const hexOf = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('')
const luma01 = c => c[0] / 255 * 0.55 + c[1] / 255 * 0.6 + c[2] / 255 * 0.25

async function fetchJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`)
  return r.json()
}

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
    this.itemById = new Map()
    this.items = []
    this.categories = []
    this.loaded = false

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
    this.selGroup = null
    this.selBox = null
    this.moveArmed = false
    this.pendingScale = 1
    this.snapStep = 1
    this.freeMove = false
    this.overlapTarget = null

    // ---- voxel build mode ----
    this.voxMode = null // null | 'add' | 'remove'
    this.voxMat = 'grass'
    this.voxelRoot = new THREE.Group()
    scene.add(this.voxelRoot)
    this.voxelMeshes = new Map() // "x,y,z" -> mesh
    this._voxGhost = null
    this.snapStep = 1
    this.freeMove = false
    this.overlapTarget = null

    this.cellMark = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: '#9FE8B0', transparent: true, opacity: 0.35, depthWrite: false })
    )
    this.cellMark.rotation.x = -Math.PI / 2
    this.cellMark.visible = false
    scene.add(this.cellMark)

    // voxel ghost (preview of block to place)
    const vg = new THREE.BoxGeometry(1, 1, 1)
    this._voxGhost = new THREE.Mesh(vg, new THREE.MeshBasicMaterial({
      color: '#7FD88F', transparent: true, opacity: 0.4, depthWrite: false
    }))
    this._voxGhost.visible = false
    scene.add(this._voxGhost)

    this.replaceMat = new THREE.MeshBasicMaterial({
      color: '#FF5A5A', transparent: true, opacity: 0.55,
      depthWrite: false, toneMapped: false
    })

    // synergy auras
    this._auras = new Map()
    this._auraAcc = 0
  }

  setSnapStep(v) {
    this.snapStep = v
    return this.snapStep > 0 ? ('Grid ' + (+this.snapStep.toFixed(2))) : 'Bebas'
  }

  setFreeMove(on) {
    this.freeMove = !!on
    return this.freeMove
  }

  // ---- voxel build mode ----
  setVoxMode(mode) {
    this.voxMode = mode // null | 'add' | 'remove'
    if (!mode && this._voxGhost) this._voxGhost.visible = false
    if (mode) {
      this.exitGhost()
      this.clearSelection()
      this.active = false
      this.selected = null
    }
  }

  setVoxMat(mat) {
    if (VOXEL_MATS[mat]) this.voxMat = mat
  }

  _voxKey(x, y, z) { return x + ',' + y + ',' + z }

  handleVoxPointer(cx, cy, camera, raycaster, commit) {
    const ndc = new THREE.Vector2(
      (cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1
    )
    raycaster.setFromCamera(ndc, camera)

    const allTargets = [...this.world.groundTargets(), ...this.voxelRoot.children]
    const hits = raycaster.intersectObjects(allTargets, false)
    if (!hits.length) { this._voxGhost.visible = false; return }

    const hit = hits[0]
    const p = hit.point
    const normal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0)

    let vx, vy, vz
    if (this.voxMode === 'add') {
      vx = Math.round(p.x + normal.x * 0.5)
      vy = Math.round(p.y + normal.y * 0.5)
      vz = Math.round(p.z + normal.z * 0.5)
    } else {
      vx = Math.round(p.x); vy = Math.round(p.y); vz = Math.round(p.z)
    }
    const k = this._voxKey(vx, vy, vz)

    if (this.voxMode === 'add') {
      this._voxGhost.position.set(vx, vy, vz)
      this._voxGhost.material.color.set(VOXEL_MATS[this.voxMat]?.color || '#7FB069')
      this._voxGhost.visible = true
      if (!commit) return
      if (this.voxelMeshes.has(k)) return // sudah ada blok di sini
      const matCfg = VOXEL_MATS[this.voxMat]
      const mat = new THREE.MeshLambertMaterial({
        color: matCfg.color,
        transparent: !!matCfg.transparent,
        opacity: matCfg.opacity || 1
      })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat)
      mesh.position.set(vx, vy, vz)
      mesh.userData.mat = this.voxMat
      this.voxelRoot.add(mesh)
      this.voxelMeshes.set(k, mesh)
      this.hooks.onVoxelPlaced?.({ x: vx, y: vy, z: vz, mat: this.voxMat })
    } else if (this.voxMode === 'remove') {
      if (this.voxelMeshes.has(k)) {
        this._voxGhost.position.set(vx, vy, vz)
        this._voxGhost.material.color.set('#FF5A5A')
        this._voxGhost.visible = true
        if (!commit) return
        const m = this.voxelMeshes.get(k)
        this.voxelRoot.remove(m)
        m.geometry.dispose(); m.material.dispose()
        this.voxelMeshes.delete(k)
        this.hooks.onVoxelRemoved?.({ x: vx, y: vy, z: vz })
      } else {
        // coba hapus dari terrain (hanya visual — tandai sebagai removed)
        this._voxGhost.position.set(vx, vy, vz)
        this._voxGhost.material.color.set('#FF5A5A')
        this._voxGhost.visible = true
        if (!commit) return
        this.hooks.onVoxelRemoved?.({ x: vx, y: vy, z: vz })
      }
    }
  }

  getVoxelMods() {
    const mods = []
    for (const [k, mesh] of this.voxelMeshes) {
      const [x, y, z] = k.split(',').map(Number)
      mods.push({ op: 'add', x, y, z, mat: mesh.userData.mat || 'grass' })
    }
    return mods
  }

  loadVoxelMods(mods) {
    if (!Array.isArray(mods)) return
    for (const m of mods) {
      if (m.op !== 'add' || !m.mat) continue
      const matCfg = VOXEL_MATS[m.mat] || VOXEL_MATS.grass
      const mat = new THREE.MeshLambertMaterial({
        color: matCfg.color,
        transparent: !!matCfg.transparent,
        opacity: matCfg.opacity || 1
      })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat)
      mesh.position.set(m.x, m.y, m.z)
      mesh.userData.mat = m.mat
      this.voxelRoot.add(mesh)
      this.voxelMeshes.set(this._voxKey(m.x, m.y, m.z), mesh)
    }
  }

  clearVoxelEdits() {
    while (this.voxelRoot.children.length) {
      const c = this.voxelRoot.children[0]
      this.voxelRoot.remove(c)
      c.geometry.dispose(); c.material.dispose()
    }
    this.voxelMeshes.clear()
  }

  updateSynergyAuras() {
    const uniq = this.state._uniq || []
    const activeIds = new Set()
    for (const u of uniq) {
      for (const id of [...(u.a || []), ...(u.b || [])]) activeIds.add(id)
    }
    // hapus aura untuk objek yang tidak lagi bersinergi
    for (const [ck, ring] of this._auras) {
      const g = this.placedGroups.get(ck)
      const type = g?.userData.type
      if (!type || !activeIds.has(type)) {
        this.scene.remove(ring)
        ring.geometry.dispose(); ring.material.dispose()
        this._auras.delete(ck)
      }
    }
    // tambah aura untuk objek yang membentuk resep
    for (const [ck, g] of this.placedGroups) {
      if (this._auras.has(ck)) continue
      const type = g.userData.type
      if (!type || !activeIds.has(type)) continue
      const geo = new THREE.RingGeometry(0.9, 1.25, 24)
      const mat = new THREE.MeshBasicMaterial({
        color: '#FFD76E', transparent: true, opacity: 0.3,
        side: THREE.DoubleSide, depthWrite: false, toneMapped: false
      })
      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = -Math.PI / 2
      ring.position.set(g.position.x, g.position.y + 0.06, g.position.z)
      ring.userData.isAura = true
      this.scene.add(ring)
      this._auras.set(ck, ring)
    }
  }

  animateAuras(tGlob) {
    for (const ring of this._auras.values()) {
      const pulse = 1 + Math.sin(tGlob * 2.2) * 0.18
      ring.scale.setScalar(pulse)
      ring.material.opacity = 0.22 + Math.sin(tGlob * 2.2 + 0.5) * 0.14
    }
  }

  disposeAuras() {
    for (const ring of this._auras.values()) {
      this.scene.remove(ring)
      ring.geometry.dispose(); ring.material.dispose()
    }
    this._auras.clear()
  }

  _markOverlap(g) {
    if (this.overlapTarget === g) return
    this._unmarkOverlap()
    if (!g || g === this.selGroup) return
    this.overlapTarget = g
    g.userData._origMats = g.children.map(m => m.material)
    g.children.forEach(m => (m.material = this.replaceMat))
  }

  _unmarkOverlap() {
    const g = this.overlapTarget
    if (!g) return
    if (g.userData.marked !== false && g.userData._origMats) {
      g.children.forEach((m, i) => {
        const o = g.userData._origMats[i]
        if (o) m.material = o
      })
    }
    delete g.userData._origMats
    this.overlapTarget = null
  }

  _consumeOverlap() {
    const g = this.overlapTarget
    if (!g) return null
    const def = this.itemById.get(g.userData.type)
    this._unmarkOverlap()
    this.remove(g)
    return def
  }

  get catalog() { return this.items }

  async loadCatalog() {
    try {
      const data = await fetchJson(CATALOG_URL)
      this.categories = Array.isArray(data?.categories) ? data.categories : []
      const items = Array.isArray(data?.items) ? data.items : []
      for (const raw of items) {
        if (!raw?.id || !raw?.file || !raw?.cat) continue
        const def = {
          id: raw.id,
          name: raw.name || raw.id,
          cat: raw.cat,
          file: raw.file,
          price: Math.max(1, Math.round(Number(raw.price) || 100)),
          minLv: Math.max(1, Math.floor(Number(raw.minLv) || 1)),
          zone: raw.zone === 'water' ? 'water' : 'land',
          scale: Number(raw.scale) > 0 ? Number(raw.scale) : 1,
          size: Array.isArray(raw.size) ? raw.size : [1, 1, 1]
        }
        this.itemById.set(def.id, def)
        this.items.push(def)
      }
      this.loaded = true
    } catch (e) {
      console.warn('[store] catalog.json tidak tersedia — jalankan `npm run store`', e)
      this.loaded = true
    }
    return this.items
  }

  _register(def, parsed) {
    if (!parsed?.voxels?.length) return false
    const solid = []
    const glow = []
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (const v of parsed.voxels) {
      if (!v.i) continue
      if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x
      if (v.z < minY) minY = v.z; if (v.z > maxY) maxY = v.z
      if (v.y < minZ) minZ = v.y; if (v.y > maxZ) maxZ = v.y
    }
    if (!Number.isFinite(minX)) return false
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    for (const v of parsed.voxels) {
      if (!v.i) continue
      const pal = parsed.palette?.[v.i - 1] || [128, 128, 128]
      const entry = {
        x: v.x - cx, y: v.z - minY, z: v.y - cz,
        c: hexOf(pal[0], pal[1], pal[2]),
        s: 1, glow: luma01(pal) >= 0.83, win: false, sway: 0, sss: 0
      }
      ;(entry.glow ? glow : solid).push(entry)
    }
    const occ = new Map(
      [...solid, ...glow].map(v => [v.x + ',' + v.y + ',' + v.z, v])
    )
    def.size = [maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1]
    this.templates.set(def.id, {
      solid: buildVoxelGeometry(solid, { ao: true, occupancy: occ }),
      glow: buildVoxelGeometry(glow, { ao: false, flat: true, occupancy: occ }),
      def
    })
    return true
  }

  async ensureTemplate(id) {
    if (this.templates.has(id)) return true
    const def = this.itemById.get(id)
    if (!def) return false
    try {
      const r = await fetch(def.file)
      if (!r.ok) throw new Error(String(r.status))
      const parsed = parseVox(await r.arrayBuffer())
      const ok = this._register(def, parsed)
      if (!ok) throw new Error('voxel kosong')
      return true
    } catch (e) {
      console.warn('[store] gagal memuat aset', def.file, e)
      return false
    }
  }

  slotsLeft() { return Math.max(0, this.state.slots() - this.state.placements.length) }

  get managing() { return this.mode === 'manage' }

  setRaycaster(camera, raycaster, cx, cy) {
    this._cam = camera
    this._rc = raycaster
    this._cx = cx
    this._cy = cy
  }

  perFrameUpdate() {
    if (this.managing && this.moveArmed && this.selGroup && this._rc) {
      const ndc = new THREE.Vector2(
        (this._cx / window.innerWidth) * 2 - 1, -(this._cy / window.innerHeight) * 2 + 1
      )
      this._rc.setFromCamera(ndc, this._cam)
      this._movePreview(ndc, this._cam, this._rc, false)
    }
    if (this.voxMode && this._rc) {
      this.handleVoxPointer(this._cx || 400, this._cy || 300, this._cam, this._rc, false)
    }
  }

  select(id) {
    this.exitGhost()
    this.clearSelection()
    this.mode = 'place'
    this.rot = 0
    if (!id || !this.itemById.has(id)) {
      this.active = false
      this.selected = null
      this.pendingScale = 1
      return id ? false : true
    }
    if (this.selected !== id) this.pendingScale = 1
    this.selected = id
    if (this.templates.has(id)) {
      this.active = true
      this.makeGhost(id)
      return true
    }
    this.active = false
    const want = id
    this.ensureTemplate(want).then(ok => {
      if (this.selected !== want || this.mode !== 'place') return
      if (!ok) {
        this.selected = null
        this.active = false
        this.hooks.onSelectFailed?.(want)
        return
      }
      this.active = true
      this.makeGhost(want)
      this.hooks.onTemplateReady?.(want)
    })
    return 'loading'
  }

  setMode(m) {
    this.mode = m
    if (m !== 'place') {
      this.exitGhost()
      if (this.ghost) this.ghost.visible = false
    }
    if (m !== 'manage') this.clearSelection()
    // vox mode cleanup
    if (this.voxMode && m !== 'vox') {
      this.voxMode = null
      if (this._voxGhost) this._voxGhost.visible = false
    }
  }

  clearSelection() {
    this._unmarkOverlap()
    if (this.selBox) {
      this.scene.remove(this.selBox)
      this.selBox.geometry.dispose()
      this.selBox.material.dispose?.()
      this.selBox = null
    }
    this.selGroup = null
    this.moveArmed = false
    this.hooks.onSelChange?.(null)
  }

  _recOf(g) {
    return this.state.placements.find(p => this._pk(p.p || '', p.x, p.z) === g.userData.ck)
  }

  _selInfo() {
    if (!this.selGroup) return null
    const item = this.itemById.get(this.selGroup.userData.type)
    const lv = this.selGroup.userData.lv || 1
    const upCost = Math.floor((item?.price || 0) * 0.6 * Math.pow(1.6, lv - 1))
    return {
      name: item?.name || this.selGroup.userData.type,
      pct: Math.round(((this.selGroup.userData.s ?? 1)) * 100),
      moving: !!this.moveArmed,
      lv,
      upCost
    }
  }

  _makeLvBadge(lv) {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas')
    c.width = 64; c.height = 32
    const ctx = c.getContext('2d')
    ctx.fillStyle = 'rgba(20,15,40,.72)'
    ctx.beginPath(); ctx.roundRect(2, 2, 60, 28, 8); ctx.fill()
    ctx.strokeStyle = 'rgba(255,215,110,.7)'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.roundRect(2, 2, 60, 28, 8); ctx.stroke()
    ctx.fillStyle = '#FFD76E'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('⬆' + lv, 32, 22)
    const tex = new THREE.CanvasTexture(c)
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, toneMapped: false, depthTest: false }))
    spr.scale.set(2.4, 1.2, 1)
    spr.renderOrder = 10
    return spr
  }

  _refreshBadge(g, item) {
    // hapus badge lama
    for (let i = g.children.length - 1; i >= 0; i--) {
      if (g.children[i].userData?.isBadge) {
        g.children[i].material.map.dispose()
        g.children[i].material.dispose()
        g.remove(g.children[i])
      }
    }
    const lv = g.userData.lv || 1
    if (lv < 2) return
    const badge = this._makeLvBadge(lv)
    if (!badge) return
    badge.userData.isBadge = true
    const h = ((item?.size?.[1] || 10)) * (item?.scale || 1) * (g.userData.s ?? 1)
    badge.position.y = h + 0.8
    g.add(badge)
  }

  upgradeSelected() {
    const g = this.selGroup
    if (!g) return null
    const item = this.itemById.get(g.userData.type)
    if (!item?.price) return null
    const rec = this._recOf(g)
    if (!rec) return null
    const lv = g.userData.lv || 1
    const cost = Math.floor(item.price * 0.6 * Math.pow(1.6, lv - 1))
    if (this.state.essence < cost) return { ok: false, cost }
    this.state.essence -= cost
    rec.v = lv + 1
    g.userData.lv = rec.v
    this.state.recalc?.()
    this._refreshBadge(g, item)
    this.selBox?.update()
    return { ok: true, lv: rec.v, cost }
  }

  selectPlaced(g) {
    this.clearSelection()
    if (!g || g.parent !== this.placedRoot) return
    this.selGroup = g
    this.selBox = new THREE.BoxHelper(g, new THREE.Color('#FFD27A'))
    this.selBox.material.toneMapped = false
    this.scene.add(this.selBox)
    this.hooks.onSelChange?.(this._selInfo())
  }

  rotateSelected(dir) {
    const g = this.selGroup
    if (!g) return
    const rec = this._recOf(g)
    if (!rec) return
    const legacy = (rec.r | 0) <= 3 && rec.r !== 0 ? rec.r * 90 : rec.r
    rec.r = ((legacy | 0) + (dir > 0 ? 15 : -15) + 720) % 360
    g.rotation.y = rec.r * Math.PI / 180
    this.selBox?.update()
  }

  scaleSelected(f) {
    const g = this.selGroup
    if (!g) return
    const item = this.itemById.get(g.userData.type)
    const cur = g.userData.s ?? 1
    const next = Math.min(3, Math.max(0.4, Math.round(cur * f * 100) / 100))
    if (next === cur) return
    g.userData.s = next
    g.scale.setScalar((item?.scale || 1) * next)
    const rec = this._recOf(g)
    if (rec) rec.s = next
    this.selBox?.update()
    this.hooks.onSelChange?.(this._selInfo())
  }

  toggleMoveSelected() {
    if (!this.selGroup) return false
    this.moveArmed = !this.moveArmed
    const g = this.selGroup
    if (this.moveArmed) {
      // angkat objek + ghost material hijau
      this._moveOrigY = g.position.y
      g.position.y += 0.5
      g.userData._moveOrig = g.children.map(m => m.material)
      g.children.forEach(m => {
        if (!m.userData?.isBadge) m.material = this.ghostOk
      })
    } else {
      // batal — kembalikan posisi & material
      if (g.userData._moveOrigY !== undefined) {
        g.position.y = g.userData._moveOrigY
        delete g.userData._moveOrigY
      }
      this._restoreMoveMats(g)
      const rec = this._recOf(g)
      if (rec) { g.position.x = rec.x; g.position.z = rec.z; g.position.y = this.world.cellAt(rec.x, rec.z)?.top ?? 10 }
    }
    this.hooks.onSelChange?.(this._selInfo())
    return true
  }

  _restoreMoveMats(g) {
    if (g.userData._moveOrig) {
      g.children.forEach((m, i) => {
        const o = g.userData._moveOrig[i]
        if (o && !m.userData?.isBadge) m.material = o
      })
      delete g.userData._moveOrig
    }
  }

  updateMovingObject(mx, my, camera, raycaster) {
    if (!this.moveArmed || !this.selGroup) return
    const ndc = new THREE.Vector2(
      (mx / window.innerWidth) * 2 - 1, -(my / window.innerHeight) * 2 + 1
    )
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObjects(this.world.groundTargets(), false)
    if (!hits.length) return
    const p = hits[0].point
    const x = Math.round(p.x), z = Math.round(p.z)
    this._pendingX = x; this._pendingZ = z; this._pendingY = p.y
    this.selGroup.position.set(x, p.y + 0.5, z)
    this.selBox?.update()
  }

  commitMove() {
    if (!this.moveArmed || !this.selGroup || this._pendingX === undefined) return false
    const g = this.selGroup
    const x = this._pendingX, z = this._pendingZ, y = this._pendingY
    this._restoreMoveMats(g)
    g.position.set(x, y, z)
    const oldPk = g.userData.ck
    const rec = this._recOf(g)
    this.occupancy.delete(oldPk)
    this.placedGroups.delete(oldPk)
    const pk = this._pk('', x, z)
    g.userData.ck = pk
    this.occupancy.add(pk)
    this.placedGroups.set(pk, g)
    if (rec) { rec.x = x; rec.z = z; rec.p = '' }
    this.moveArmed = false
    delete this._pendingX; delete this._pendingZ; delete this._pendingY
    this.hooks.onSelChange?.(this._selInfo())
    return true
  }

  deleteSelected() {
    const g = this.selGroup
    if (!g) return
    this.clearSelection()
    this.remove(g, { refund: true })
  }

  clearAllPlaced() {
    this.clearSelection()
    this.exitGhost()
    this._unmarkOverlap()
    while (this.placedRoot.children.length) this.placedRoot.remove(this.placedRoot.children[0])
    this.occupancy.clear()
    this.placedGroups.clear()
    this.state.placements.length = 0
    this._localDirty = true
    this.state.recalc?.()
  }

  _movePreview(ndc, camera, raycaster, commit) {
    const g = this.selGroup
    if (!g || !this.moveArmed) return
    const targets = this.freeMove
      ? [...this.world.groundTargets(), ...this.placedRoot.children.filter(c => c !== g)]
      : this.world.groundTargets()
    const hits = raycaster.intersectObjects(targets, false)
    if (!hits.length) return
    const p = hits[0].point
    const x = this.snapStep > 0 ? Math.round(p.x / this.snapStep) * this.snapStep : +p.x.toFixed(2)
    const z = this.snapStep > 0 ? Math.round(p.z / this.snapStep) * this.snapStep : +p.z.toFixed(2)
    const item = this.itemById.get(g.userData.type)
    if (!item) return

    let prefix = ''
    let y = g.position.y
    if (this.freeMove) {
      y = p.y
    } else {
      const hitWater = hits[0].object === this.world.water || hits[0].object === this.world.lotusWater
      const info = hitWater ? { kind: 'water', prefix: '' } : this.world.cellAt(x, z)
      if (!info || info.kind !== item.zone) return
      prefix = info.prefix || ''
      y = info.kind === 'land' ? info.top : (Math.hypot(x + 4.5, z + 3.5) < 6 ? 8.9 : 8.15)
    }

    let blocker = null
    for (const other of this.placedGroups.values()) {
      if (other === g) continue
      if (Math.abs(other.position.x - x) < 0.5 && Math.abs(other.position.z - z) < 0.5 && Math.abs(other.position.y - y) < 1.6) {
        blocker = other
        break
      }
    }

    g.position.set(x, y, z)
    this.selBox?.update()
    this.hooks.onMovePos?.({ x: +x.toFixed(2), z: +z.toFixed(2), replacing: !!blocker })

    if (!commit) {
      this._markOverlap(blocker)
      return
    }
    // commit: restore material asli sebelum finalisasi
    if (g.userData._moveOrig) {
      g.children.forEach((m, i) => {
        const o = g.userData._moveOrig[i]
        if (o && !m.userData?.isBadge) m.material = o
      })
      delete g.userData._moveOrig
    }
    const replaced = blocker ? this._consumeOverlap() : null
    const oldPk = g.userData.ck
    const rec = this._recOf(g)
    this.occupancy.delete(oldPk)
    this.placedGroups.delete(oldPk)
    const pk = this._pk(prefix, x, z)
    g.userData.ck = pk
    this.occupancy.add(pk)
    this.placedGroups.set(pk, g)
    if (rec) { rec.x = x; rec.z = z; rec.p = prefix }
    this.moveArmed = false
    this.hooks.onSelChange?.(this._selInfo())
    if (replaced) this.hooks.onReplaced?.(replaced)
  }

  rotate(dir = 1) {
    this.rot = (this.rot + (dir > 0 ? 15 : -15) + 360) % 360
    if (this.ghost) this.ghost.rotation.y = this.rot * Math.PI / 180
  }

  setPendingScale(f) {
    const def = this.itemById.get(this.selected)
    const cur = this.pendingScale ?? 1
    const next = Math.min(3, Math.max(0.4, Math.round(cur * f * 100) / 100))
    this.pendingScale = next
    if (this.ghost && def) {
      this.ghost.scale.setScalar((def.scale || 1) * next)
      const cell = this._lastCell
      if (cell) this.ghost.position.set(cell.x, cell.y, cell.z)
    }
    return Math.round(next * 100)
  }

  copiesLeft(id) {
    if (!id) return 0
    const owned = this.state.storeCopies(id)
    const placed = this.state.placements.filter(p => p.t === id).length
    return owned - placed
  }

  exitGhost() {
    this.cellMark && (this.cellMark.visible = false)
    this._unmarkOverlap()
    if (this.ghost) {
      this.scene.remove(this.ghost)
      this.ghost = null
    }
  }

  makeGhost(id) {
    const tpl = this.templates.get(id)
    const def = this.itemById.get(id)
    if (!tpl || !def) return
    const g = new THREE.Group()
    if (tpl.solid) g.add(new THREE.Mesh(tpl.solid, this.ghostOk))
    if (tpl.glow) g.add(new THREE.Mesh(tpl.glow, this.ghostOk))
    g.scale.setScalar((def.scale || 1) * (this.pendingScale ?? 1))
    g.rotation.y = this.rot * Math.PI / 180
    g.visible = false
    this.ghost = g
    this.scene.add(g)
  }

  _pk(prefix, x, z) { return prefix + ':' + x + ',' + z }

  handlePointer(cx, cy, camera, raycaster, commit) {
    const ndc = new THREE.Vector2(
      (cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1
    )
    raycaster.setFromCamera(ndc, camera)

    if (this.mode === 'manage') {
      if (!this.selGroup) return
      if (this.moveArmed) {
        this._movePreview(ndc, camera, raycaster, commit)
        return
      }
      if (!commit) return
      const hits = raycaster.intersectObjects(this.placedRoot.children, true)
      if (!hits.length) {
        this.clearSelection()
        return
      }
      let o = hits[0].object
      while (o.parent && o.parent !== this.placedRoot) o = o.parent
      if (o !== this.selGroup) this.selectPlaced(o)
      return
    }

    if (!this.active && this.mode !== 'remove') {
      this.cellMark.visible = false
      return
    }
    if (this.mode === 'remove') {
      this.cellMark.visible = false
      if (this.ghost) this.ghost.visible = false
      if (!commit) return
      const hits = raycaster.intersectObjects(this.placedRoot.children, true)
      if (!hits.length) return
      let o = hits[0].object
      while (o.parent && o.parent !== this.placedRoot) o = o.parent
      this.remove(o, { refund: true })
      return
    }

    const hits = raycaster.intersectObjects(this.world.groundTargets(), false)
    let pos = null, valid = false
    const item = this.itemById.get(this.selected)

    if (!item) return

    if (hits.length) {
      const p = hits[0].point
      const x = this.snapStep > 0 ? Math.round(p.x / this.snapStep) * this.snapStep : +p.x.toFixed(2)
      const z = this.snapStep > 0 ? Math.round(p.z / this.snapStep) * this.snapStep : +p.z.toFixed(2)
      const hitWater = hits[0].object === this.world.water || hits[0].object === this.world.lotusWater
      let info = hitWater ? { kind: 'water', top: 9.74, prefix: '' } : this.world.cellAt(x, z)
      if (info && info.kind === item.zone) {
        if (info.kind === 'land') {
          const pk = this._pk(info.prefix, x, z)
          const isleOk = (info.prefix !== 'D' || this.world.isleRevealed) &&
            (info.prefix !== 'J' || this.world.jadeRevealed) &&
            (info.prefix !== 'L' || this.world.lotusRevealed) &&
            (info.prefix !== 'S' || this.world.starRevealed)
          valid = isleOk && this.slotsLeft() > 0
          pos = { x, z, pk, prefix: info.prefix, y: info.top }
        } else {
          if (this.world.waterCells.has(x + ',' + z)) {
            const onMainPond = Math.hypot(x - -4.5, z - -3.5) < 6
            const pk = this._pk('', x, z)
            valid = this.slotsLeft() > 0
            pos = { x, z, pk, prefix: '', y: onMainPond ? 8.9 : 8.15 }
          }
        }
      }
    }

    const occGroup = pos ? this.placedGroups.get(pos.pk) : null
    this._markOverlap(occGroup || null)
    if (pos) {
      this.ghost.position.set(pos.x, pos.y, pos.z)
      this.ghost.rotation.y = this.rot * Math.PI / 180
      this.ghost.visible = true
      const replacing = !!occGroup
      const mat = !valid ? this.ghostBad : replacing ? this.replaceMat : this.ghostOk
      this.ghost.children.forEach(m => (m.material = mat))
    } else if (this.ghost) {
      this.ghost.visible = false
    }
    this.cellMark.visible = !!pos && valid
    if (this.cellMark.visible) {
      const lift = item.zone === 'water' ? 0.12 : 0.06
      this.cellMark.position.set(pos.x, pos.y + lift, pos.z)
    }
    this._lastValid = valid
    this._lastCell = pos

    if (commit && valid && pos) {
      const repDef = occGroup ? this._consumeOverlap() : null
      const placed = this.place(this.selected, pos, false, null, true, this.pendingScale ?? 1)
      this.cellMark.visible = false
      if (repDef) this.hooks.onReplaced?.(repDef)
      if (placed) {
        const left = this.copiesLeft(this.selected)
        if (left <= 0) {
          const def = this.itemById.get(this.selected)
          this.exitGhost()
          this.active = false
          const doneId = this.selected
          this.selected = null
          this.pendingScale = 1
          this.hooks.onExhausted?.(def || { id: doneId })
        }
      }
    }
  }

  place(typeId, cell, silent = false, rotOverride = null, record = true, scaleOverride = null, lvOverride = null) {
    const item = this.itemById.get(typeId)
    const tpl = this.templates.get(typeId)
    if (!item || !tpl) return false
    const g = new THREE.Group()
    if (tpl.solid) g.add(new THREE.Mesh(tpl.solid, this.solidMat))
    if (tpl.glow) g.add(new THREE.Mesh(tpl.glow, this.glowMat))
    const sMul = Number.isFinite(+scaleOverride) && +scaleOverride > 0 ? +scaleOverride : 1
    const lv = Math.max(1, Math.floor(Number(lvOverride) || 1))
    const baseScale = item.scale || 1
    const rot = rotOverride !== null ? rotOverride : this.rot
    g.position.set(cell.x, cell.y, cell.z)
    g.rotation.y = rot * Math.PI / 180
    g.scale.setScalar(baseScale * sMul)
    g.userData = { ck: cell.pk, type: typeId, s: sMul, lv }
    this.placedRoot.add(g)
    this.occupancy.add(cell.pk)
    this.placedGroups.set(cell.pk, g)
    if (record) {
      this.state.placements.push({ t: typeId, x: cell.x, z: cell.z, r: rot, p: cell.prefix, s: sMul, v: lv })
      this.state.recalc?.()
      if (lv > 1) this._refreshBadge(g, item)
    }
    if (!silent) {
      gsap.fromTo(g.scale, { x: baseScale * sMul * 0.05, y: baseScale * sMul * 0.05, z: baseScale * sMul * 0.05 }, {
        x: baseScale * sMul, y: baseScale * sMul, z: baseScale * sMul,
        duration: 0.55, ease: 'elastic.out(1, 0.55)'
      })
      this._groundRipple(cell.x, cell.y, cell.z, baseScale * sMul)
      if (this.hooks.onPlaced) this.hooks.onPlaced(item, g.position)
    }
    return true
  }

  _groundRipple(x, y, z, size) {
    const geo = new THREE.RingGeometry(0.2, 0.35, 24)
    const mat = new THREE.MeshBasicMaterial({
      color: '#BFE8CD', transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, depthWrite: false, toneMapped: false
    })
    const ring = new THREE.Mesh(geo, mat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(x, y + 0.08, z)
    this.scene.add(ring)
    gsap.to(ring.scale, { x: size * 3, y: size * 3, z: 1, duration: 0.7, ease: 'power1.out' })
    gsap.to(ring.material, {
      opacity: 0, duration: 0.7, ease: 'power1.out',
      onComplete: () => { this.scene.remove(ring); ring.geometry.dispose(); ring.material.dispose() }
    })
  }

  remove(groupObj, opts = {}) {
    const { ck } = groupObj.userData
    const type = groupObj.userData.type
    const item = this.itemById.get(type)
    this.placedRoot.remove(groupObj)
    this.occupancy.delete(ck)
    this.placedGroups.delete(ck)
    const idx = this.state.placements.findIndex(p => this._pk(p.p || '', p.x, p.z) === ck)
    if (idx >= 0) this.state.placements.splice(idx, 1)
    this._localDirty = true
    this.state.recalc?.()
    if (opts.refund && item?.price) {
      this.state.essence += Math.floor(item.price / 2)
      this.state.totalEarned += 0
    }
    if (this.hooks.onRemoved) this.hooks.onRemoved(item, groupObj.position)
  }

  storeSelected() {
    const g = this.selGroup
    if (!g) return null
    const item = this.itemById.get(g.userData.type)
    this.clearSelection()
    this.exitGhost()
    this.active = false
    this.selected = null
    this.pendingScale = 1
    this.remove(g)
    return item
  }

  loadList(arr) {
    if (!Array.isArray(arr)) return
    for (const d of arr) {
      try {
        if (!d || typeof d !== 'object' || !Number.isFinite(d.x) || !Number.isFinite(d.z)) continue
        if (!this.templates.has(d.t)) continue
        const pfx = d.p || ''
        if ((pfx === 'J' && !this.world.jadeRevealed) ||
          (pfx === 'D' && !this.world.isleRevealed) ||
          (pfx === 'L' && !this.world.lotusRevealed) ||
          (pfx === 'S' && !this.world.starRevealed)) continue
        const pk = this._pk(pfx, d.x, d.z)
        if (this.occupancy.has(pk)) continue
        const info = this.world.cellAt(d.x, d.z)
        const item = this.itemById.get(d.t)
        if (info && info.kind === item?.zone) {
          const y = info.kind === 'land' ? info.top : (Math.hypot(d.x + 4.5, d.z + 3.5) < 6 ? 8.9 : 8.15)
          const deg = (d.r | 0) <= 3 ? (d.r | 0) * 90 : (d.r | 0)
          this.place(d.t, { x: d.x, z: d.z, pk, prefix: pfx, y }, true, deg, true, Number(d.s), Number(d.v) || 1)
          const placedG = [...this.placedGroups.values()].pop()
          if (placedG) {
            const placedDef = this.itemById.get(d.t)
            if (placedG.userData.lv > 1 && placedDef) this._refreshBadge(placedG, placedDef)
          }
        }
      } catch (e) { /* skip broken placement entry */ }
    }
  }
}
