const luma = c => (c[0] / 255) * 0.55 + (c[1] / 255) * 0.6 + (c[2] / 255) * 0.25

export function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('spec bukan objek')
  const size = spec.size
  if (!Array.isArray(size) || size.length !== 3 || size.some(v => !Number.isInteger(v) || v < 6 || v > 32))
    throw new Error('size harus [W,H,D] integer 6..32')
  if (!Array.isArray(spec.palette) || spec.palette.length < 1 || spec.palette.length > 32)
    throw new Error('palette harus 1..32 warna')
  for (const c of spec.palette)
    if (!Array.isArray(c) || c.length !== 3 || c.some(v => !Number.isInteger(v) || v < 0 || v > 255))
      throw new Error('warna palette harus [r,g,b] 0-255')
  if (!Array.isArray(spec.ops) || !spec.ops.length) throw new Error('ops kosong')
  if (spec.ops.length > 400) throw new Error('terlalu banyak ops (maks 400)')
  return spec
}

export function execOps(spec) {
  validateSpec(spec)
  const [sx, sy, sz] = spec.size
  const cells = new Map()
  const set = (x, y, z, c) => {
    x = Math.round(x); y = Math.round(y); z = Math.round(z)
    if (c < 1 || c > spec.palette.length) return
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return
    cells.set(x + ',' + y + ',' + z, c)
  }

  for (const op of spec.ops) {
    const k = op[0]
    const a = op.slice(1).map(Number)
    if (k === 'vox') {
      set(a[0], a[1], a[2], a[3])
    } else if (k === 'box') {
      const [x0, y0, z0, x1, y1, z1, c] = a
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
          for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) set(x, y, z, c)
    } else if (k === 'shell') {
      const [x0, y0, z0, x1, y1, z1, c] = a
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
          for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
            const ex = x === x0 || x === x1, ey = y === y0 || y === y1, ez = z === z0 || z === z1
            if (ex || ey || ez) set(x, y, z, c)
          }
    } else if (k === 'ball') {
      const [cx, cy, cz, r, c] = a
      const ri = Math.ceil(r)
      for (let x = Math.floor(cx - ri); x <= Math.ceil(cx + ri); x++)
        for (let y = Math.floor(cy - ri); y <= Math.ceil(cy + ri); y++)
          for (let z = Math.floor(cz - ri); z <= Math.ceil(cz + ri); z++)
            if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r) set(x, y, z, c)
    } else if (k === 'cyl') {
      const [cx, cz, y0, y1, r, c] = a
      const ri = Math.ceil(r)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.floor(cx - ri); x <= Math.ceil(cx + ri); x++)
          for (let z = Math.floor(cz - ri); z <= Math.ceil(cz + ri); z++)
            if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) set(x, y, z, c)
    } else if (k === 'disc') {
      const [cx, cy, cz, r, c] = a
      const ri = Math.ceil(r)
      for (let x = Math.floor(cx - ri); x <= Math.ceil(cx + ri); x++)
        for (let z = Math.floor(cz - ri); z <= Math.ceil(cz + ri); z++)
          if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) set(x, y, z, c)
    } else if (k === 'line') {
      const [x0, y0, z0, x1, y1, z1, c] = a
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1)
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, c)
      }
    }
  }

  const voxels = []
  for (const [k, c] of cells) {
    const [x, y, z] = k.split(',').map(Number)
    voxels.push({ x, y, z, i: c })
  }
  return { size: [sx, sy, sz], palette: spec.palette, voxels }
}

export function modelToVoxBuffer(model) {
  const enc = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b }
  const u32 = n => new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255])
  const cat = arrs => {
    const len = arrs.reduce((n, a) => n + a.length, 0)
    const out = new Uint8Array(len)
    let o = 0
    for (const a of arrs) { out.set(a, o); o += a.length }
    return out
  }

  const chunks = []
  const sizeBody = cat(model.size.map(u32))
  chunks.push(cat([enc('SIZE'), u32(12), u32(0), sizeBody]))

  const vlist = model.voxels.map(v => new Uint8Array([v.x & 255, v.y & 255, v.z & 255, v.i & 255]))
  const xyziBody = cat([u32(vlist.length), ...vlist])
  chunks.push(cat([enc('XYZI'), u32(xyziBody.length), u32(0), xyziBody]))

  const rows = []
  for (let i = 0; i < 255; i++) {
    const c = model.palette[i] || [0, 0, 0]
    rows.push(new Uint8Array([c[0], c[1], c[2], 255]))
  }
  const rgbaBody = cat(rows)
  chunks.push(cat([enc('RGBA'), u32(rgbaBody.length), u32(0), rgbaBody]))

  const childrenSize = chunks.reduce((n, c) => n + c.length, 0)
  return cat([enc('VOX '), u32(150), enc('MAIN'), u32(0), u32(childrenSize), ...chunks]).buffer
}

export function buildModelGroup(THREE, model, scale = 1) {
  const group = new THREE.Group()
  const solid = []
  const glow = []
  for (const v of model.voxels) {
    const c = model.palette[(v.i - 1)] || [128, 128, 128]
    ;(luma(c) >= 0.83 ? glow : solid).push({ ...v, c })
  }
  const geo = new THREE.BoxGeometry(scale, scale, scale)
  const m4 = new THREE.Matrix4()
  const col = new THREE.Color()
  const build = (list, mat) => {
    if (!list.length) return
    const mesh = new THREE.InstancedMesh(geo, mat, list.length)
    const [sx, sy, sz] = model.size
    const ox = (sx - 1) / 2, oz = (sz - 1) / 2
    list.forEach((v, i) => {
      m4.makeTranslation((v.x - ox) * scale, v.y * scale, (v.z - oz) * scale)
      mesh.setMatrixAt(i, m4)
      mesh.setColorAt(i, col.setRGB(v.c[0] / 255, v.c[1] / 255, v.c[2] / 255))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    group.add(mesh)
  }
  build(solid, new THREE.MeshLambertMaterial())
  build(glow, new THREE.MeshBasicMaterial({ toneMapped: false }))
  return group
}
