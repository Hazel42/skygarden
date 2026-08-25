import * as THREE from 'three'
import { modelToVoxBuffer, buildModelGroup } from './voxelops.js'
import { generateVoxelModel, generateProcedural, enhancePrompt, PRESETS, loadKeys, saveKeys } from './ai.js'

const LS_ASSETS = 'forge-assets-v2'

const encModel = m => {
  const b = new Uint8Array(m.voxels.length * 4)
  m.voxels.forEach((v, i) => {
    const o = i * 4
    b[o] = v.x & 255; b[o + 1] = v.y & 255; b[o + 2] = v.z & 255; b[o + 3] = v.i & 255
  })
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000))
  return btoa(s)
}

const decVoxels = b64 => {
  const bin = atob(b64)
  const n = bin.length >> 2
  const voxels = new Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    voxels[i] = { x: bin.charCodeAt(o), y: bin.charCodeAt(o + 1), z: bin.charCodeAt(o + 2), i: bin.charCodeAt(o + 3) }
  }
  return voxels
}

export class VoxelForge {
  constructor({ scene, world, onToast, getSaved, onSave }) {
    this.scene = scene
    this.world = world
    this.onToast = onToast || (() => { })
    this.getSaved = getSaved || (() => null)
    this.onSave = onSave || (() => { })
    this.$ = id => document.getElementById(id)
    this.panel = this.$('forgePanel')
    this.keys = loadKeys(import.meta.env)
    this.assets = []
    try { this.assets = JSON.parse(localStorage.getItem(LS_ASSETS) || '[]') } catch (e) { }
    this.taken = new Set(this.assets.map(a => a.pos[0] + ',' + a.pos[2]))
    this.model = null
    this.source = ''
    this.placeScale = 1
    this.busy = false
    this.pivot = null
    this.assetGroups = []
    this._wire()
    this._fillPresets()
  }

  _wire() {
    this.$('btnForge').addEventListener('click', () => this.toggle())
    this.$('btnCloseForge').addEventListener('click', () => this.toggle(false))
    this.$('btnForgeGo').addEventListener('click', () => this.doGenerate())
    this.$('forgePreset').addEventListener('change', e => {
      const p = PRESETS[+e.target.value]
      if (!p) return
      this.$('forgePrompt').value = p.prompt
      this.doGenerate()
    })
    this.$('btnForgeEnhance').addEventListener('click', () => {
      this.$('forgePrompt').value = enhancePrompt(this.$('forgePrompt').value)
      this.msg('Prompt diperjelas ✓ — klik 🪄 Generate')
    })
    this.$('btnForgePlace').addEventListener('click', () => this.doPlace())
    this.$('btnForgeDl').addEventListener('click', () => this.doDownload())
    this.$('btnForgeKeys').addEventListener('click', () => this.$('forgeKeys').classList.toggle('hidden'))
    this.$('btnForgeSaveKeys').addEventListener('click', () => {
      this.keys = {
        gemini: this.$('keyGemini').value.trim(),
        model: ''
      }
      saveKeys(this.keys)
      this.msg('Key tersimpan di perangkat ini ✓', 'ok')
    })
    const cv = this.$('forgeCanvas')
    let dragging = false, lx = 0, ly = 0
    cv.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY })
    addEventListener('pointerup', () => (dragging = false))
    cv.addEventListener('pointermove', e => {
      if (!dragging || !this.pivot) return
      this.pivot.rotation.y += (e.clientX - lx) * 0.01
      this.pivot.rotation.x = Math.max(-0.5, Math.min(0.9, this.pivot.rotation.x + (e.clientY - ly) * 0.008))
      lx = e.clientX; ly = e.clientY
    })
  }

  _fillPresets() {
    const sel = this.$('forgePreset')
    sel.innerHTML = '<option value="-1">— pilih inspirasi —</option>' +
      PRESETS.map((p, i) => `<option value="${i}">${p.label}</option>`).join('')
  }

  toggle(force) {
    const show = force !== undefined ? force : this.panel.classList.contains('hidden')
    this.panel.classList.toggle('hidden', !show)
    if (show) {
      this.initPreview()
      this.$('keyGemini').value = this.keys.gemini || ''
      this._loop()
    }
  }

  msg(text, kind) {
    const el = this.$('forgeMsg')
    el.textContent = text || ''
    el.className = 'dim authmsg' + (kind ? ' ' + kind : '')
  }

  initPreview() {
    if (this.pRenderer) return
    const canvas = this.$('forgeCanvas')
    this.pRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.pRenderer.setSize(240, 240, false)
    this.pScene = new THREE.Scene()
    this.pScene.add(new THREE.HemisphereLight('#EAF2FF', '#5A4A66', 0.9))
    const dir = new THREE.DirectionalLight('#FFF2D8', 1.2)
    dir.position.set(6, 10, 4)
    this.pScene.add(dir)
    this.pCam = new THREE.PerspectiveCamera(40, 1, 0.01, 600)
    this.pivot = new THREE.Group()
    this.pScene.add(this.pivot)
  }

  _loop() {
    if (this.panel.classList.contains('hidden')) return
    requestAnimationFrame(() => this._loop())
    if (this.pivot) {
      this.pivot.rotation.y += 0.004
      this.pCam.lookAt(0, this.pivot.userData.cy || 4, 0)
      this.pRenderer.render(this.pScene, this.pCam)
    }
  }

  async doGenerate() {
    if (this.busy) return
    const prompt = this.$('forgePrompt').value.trim()
    if (!prompt) return this.msg('Tulis prompt dulu.', 'err')
    const gs = parseInt(this.$('forgeGrid').value, 10) || 40
    this.busy = true
    this.msg(`🪄 Menyusun voxel ${gs}³…`)
    await new Promise(r => setTimeout(r, 30))
    try {
      let model, source
      try {
        ({ model, source } = await generateVoxelModel({ prompt, gridSize: gs, keys: this.keys }))
      } catch (e) {
        this.msg(`⚠️ ${e.message} — pakai fallback dasar.`)
        model = generateProcedural(prompt, gs)
        source = 'fallback'
      }
      this.model = model
      this.source = source
      this.placeScale = Math.min(1, 9 / Math.max(...model.size))
      this.showModel(model)
      this.msg(`✓ ${model.voxels.length.toLocaleString()} voxel (${source}) — 🌱 Place atau ⤓ .vox`, 'ok')
    } finally { this.busy = false }
  }

  showModel(model) {
    while (this.pivot.children.length) {
      const c = this.pivot.children.pop()
      c.traverse?.(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.() } })
    }
    const g = buildModelGroup(THREE, model, 1)
    this.pivot.add(g)
    this.pivot.userData.cy = model.size[1] / 2
    const d = Math.max(...model.size)
    this.pCam.position.set(d * 1.35, d * 1.15, d * 1.35)
  }

  findSpot(minR) {
    for (let rr = minR; rr <= 15; rr++) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + rr * 0.37
        const x = Math.round(Math.cos(a) * rr), z = Math.round(Math.sin(a) * rr)
        const k = x + ',' + z
        if (this.taken.has(k)) continue
        const info = this.world.cellAt(x, z)
        if (info && info.kind === 'land') return { x, y: info.top, z, k }
      }
    }
    return null
  }

  doPlace() {
    if (!this.model) return this.msg('Belum ada model — 🪄 Generate dulu.', 'err')
    const footR = Math.ceil(Math.max(this.model.size[0], this.model.size[2]) * this.placeScale / 2)
    const spot = this.findSpot(footR + 2)
    if (!spot) return this.msg('Tidak ada tanah kosong — perluas pulau lewat 🏪 Toko.', 'err')
    const g = buildModelGroup(THREE, this.model, this.placeScale)
    g.position.set(spot.x, spot.y + 0.05, spot.z)
    this.scene.add(g)
    this.assetGroups.push(g)
    this.taken.add(spot.k)
    this.assets.push({
      size: this.model.size,
      pal: this.model.palette,
      d: encModel(this.model),
      sc: this.placeScale,
      pos: [spot.x, spot.y, spot.z]
    })
    this.persist()
    this.onToast('🎨 Karya Forge ditempatkan di taman!')
    this.msg('Ditempatkan ✓ — tersimpan otomatis di perangkat ini', 'ok')
  }

  persist() {
    this.onSave(this.assets)
    try { localStorage.setItem(LS_ASSETS, JSON.stringify(this.assets)) } catch (e) { }
  }

  restore() {
    let list = this.getSaved()
    if (!Array.isArray(list) || !list.length) {
      try { list = JSON.parse(localStorage.getItem(LS_ASSETS) || '[]') } catch (e) { list = [] }
      if (!Array.isArray(list)) list = []
    }
    for (const a of list) {
      try {
        const model = { size: a.size, palette: a.pal, voxels: decVoxels(a.d) }
        const g = buildModelGroup(THREE, model, a.sc)
        g.position.set(a.pos[0], a.pos[1] + 0.05, a.pos[2])
        this.scene.add(g)
        this.assetGroups.push(g)
        this.assets.push(a)
        this.taken.add(a.pos[0] + ',' + a.pos[2])
      } catch (e) { console.warn('[forge] restore gagal', e) }
    }
  }

  clearAllAssets() {
    for (const g of this.assetGroups) {
      this.scene.remove(g)
      g.traverse(o => {
        if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.() }
      })
    }
    this.assetGroups = []
    this.assets = []
    this.taken.clear()
    this.onSave([])
    try { localStorage.removeItem(LS_ASSETS) } catch (e) { }
  }

  doDownload() {
    if (!this.model) return this.msg('Belum ada model — 🪄 Generate dulu.', 'err')
    const buf = modelToVoxBuffer(this.model)
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'forge-' + Date.now() + '.vox'
    a.click()
    URL.revokeObjectURL(a.href)
    this.msg('Download .vox ✓ — bisa dibuka di MagicaVoxel', 'ok')
  }
}
