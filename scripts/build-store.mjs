import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const ROOT = dirname(fileURLToPath(import.meta.url))
const STORE = join(ROOT, '..', 'public', 'models', 'store')
const PREVIEWS = join(STORE, 'previews')
const OUT = join(STORE, 'catalog.json')

const CATEGORIES = [
  { id: 'buildings', name: 'Bangunan', icon: '🏯', base: 1200, minLv: 1 },
  { id: 'nature', name: 'Alam', icon: '🌳', base: 350, minLv: 1 },
  { id: 'decor', name: 'Dekorasi', icon: '🏮', base: 600, minLv: 1 },
  { id: 'lights', name: 'Cahaya', icon: '✨', base: 450, minLv: 1 },
  { id: 'fauna', name: 'Fauna', icon: '🦊', base: 500, minLv: 1 }
]

const hash = s => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

const titleize = f => f.replace(/\.vox$/i, '').replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, c => c.toUpperCase())

function parseVox(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const u8 = buf
  let off = 0
  const tag = () => { const t = String.fromCharCode(...u8.subarray(off, off + 4)); off += 4; return t }
  const u32 = () => { const v = dv.getUint32(off, true); off += 4; return v }
  if (tag() !== 'VOX ') return null
  u32()
  if (tag() !== 'MAIN') return null
  u32()
  const end = off + u32()
  let xyzi = null, pal = null
  while (off < end) {
    const id = tag()
    const cs = u32()
    const child = u32()
    if (id === 'XYZI') {
      const n = dv.getUint32(off, true)
      xyzi = []
      for (let i = 0; i < n; i++) {
        const p = off + 4 + i * 4
        xyzi.push([u8[p], u8[p + 2], u8[p + 1], u8[p + 3]])
      }
    } else if (id === 'RGBA') {
      pal = []
      for (let i = 0; i < 255; i++) {
        const p = off + i * 4
        pal.push([u8[p], u8[p + 1], u8[p + 2]])
      }
    }
    off += cs + child
  }
  if (!xyzi || !xyzi.length) return null
  return { xyzi, pal }
}

// ---------- isometric PNG renderer (pure js) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = buf => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const pngEncode = (w, h, rgba) => {
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy ? rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
      : raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function renderIso(xyzi, pal, maxSize = 96) {
  const A = 0.866, B = 0.5, C = 1
  const key = new Set()
  for (const [x, y, z] of xyzi) key.add(x + ',' + y + ',' + z)
  const solid = xyzi.filter(([x, y, z]) => {
    let exposed = false
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      if (!key.has((x + dx) + ',' + (y + dy) + ',' + (z + dz))) { exposed = true; break }
    }
    return exposed
  })
  if (!solid.length) return null

  let sxMin = Infinity, sxMax = -Infinity, syMin = Infinity, syMax = -Infinity
  const proj = ([x, y, z]) => [(x - z) * A, (x + z) * B - y * C]
  for (const v of solid) {
    const [sx, sy] = proj(v)
    if (sx < sxMin) sxMin = sx; if (sx > sxMax) sxMax = sx
    if (sy < syMin) syMin = sy; if (sy > syMax) syMax = sy
  }
  const rangeX = sxMax - sxMin || 1
  const rangeY = syMax - syMin || 1
  const s = (maxSize - 8) / Math.max(rangeX, rangeY)
  const W = Math.max(8, Math.ceil(rangeX * s) + 8)
  const H = Math.max(8, Math.ceil(rangeY * s) + 8)
  const offX = 4 - sxMin * s
  const offY = 4 - syMin * s

  const buf = new Float64Array(W * H * 4)
  const putPoly = (pts, r, g, b) => {
    let x0 = W, x1 = 0, y0 = H, y1 = 0
    for (const [px, py] of pts) {
      if (px < x0) x0 = px; if (px > x1) x1 = px
      if (py < y0) y0 = py; if (py > y1) y1 = py
    }
    const ix0 = Math.max(0, Math.floor(x0)), ix1 = Math.min(W - 1, Math.ceil(x1))
    const iy0 = Math.max(0, Math.floor(y0)), iy1 = Math.min(H - 1, Math.ceil(y1))
    for (let yy = iy0; yy <= iy1; yy++) {
      for (let xx = ix0; xx <= ix1; xx++) {
        let inside = false
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j]
          if ((yi > yy) !== (yj > yy) && xx < ((xj - xi) * (yy - yi)) / (yj - yi) + xi) inside = !inside
        }
        if (!inside) continue
        const o = (yy * W + xx) * 4
        buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255
      }
    }
  }

  const sorted = [...solid].sort((p, q) =>
    (p[0] + p[2]) - (q[0] + q[2]) || p[1] - q[1] || p[0] - q[0]
  )
  const colOf = i => {
    const c = pal?.[i - 1]
    if (!c) { const hh = (i * 0.618) % 1; return [90 + hh * 130, 90 + ((hh * 7) % 1) * 110, 110 + ((hh * 13) % 1) * 120] }
    return c
  }
  const wHalf = A * s, hHalf = B * s, rise = C * s
  for (const [x, y, z, i] of sorted) {
    const [cx0, cy0] = proj([x, y, z])
    const px = cx0 * s + offX
    const py = cy0 * s + offY
    const [r, g, b] = colOf(i)
    putPoly([[px, py - rise - hHalf], [px + wHalf, py - rise], [px, py - rise + hHalf], [px - wHalf, py - rise]],
      Math.min(255, r * 1.08 + 14), Math.min(255, g * 1.08 + 14), Math.min(255, b * 1.08 + 12))
    putPoly([[px - wHalf, py - rise], [px, py - rise + hHalf], [px, py + hHalf], [px - wHalf, py]], r * 0.74, g * 0.74, b * 0.76)
    putPoly([[px + wHalf, py - rise], [px, py - rise + hHalf], [px, py + hHalf], [px + wHalf, py]], r * 0.52, g * 0.52, b * 0.56)
  }

  const out = Buffer.alloc(W * H * 4)
  for (let o = 0; o < out.length; o += 4) {
    out[o] = buf[o]; out[o + 1] = buf[o + 1]; out[o + 2] = buf[o + 2]; out[o + 3] = buf[o + 3]
  }
  return pngEncode(W, H, out)
}

// ---------- main ----------
if (existsSync(PREVIEWS)) rmSync(PREVIEWS, { recursive: true, force: true })
mkdirSync(PREVIEWS, { recursive: true })

const ZONE_OVERRIDES = {
  'decor/jembatan_taiko': 'water'
}

const items = []
const skipped = []
for (const cat of CATEGORIES) {
  const dir = join(STORE, cat.id)
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter(f => f.toLowerCase().endsWith('.vox')).sort()) {
    const abs = join(dir, f)
    const info = parseVox(new Uint8Array(readFileSync(abs)))
    if (!info) { skipped.push(cat.id + '/' + f); continue }
    const xs = info.xyzi.map(v => v[0]), ys = info.xyzi.map(v => v[1]), zs = info.xyzi.map(v => v[2])
    const tight = [
      Math.max(...xs) - Math.min(...xs) + 1,
      Math.max(...ys) - Math.min(...ys) + 1,
      Math.max(...zs) - Math.min(...zs) + 1
    ]
    const maxDim = Math.max(...tight)
    const jitter = 0.7 + (hash(f + cat.id) % 61) / 100
    const sizeMul = Math.pow(Math.max(maxDim, 4) / 12, 1.25)
    const price = Math.max(60, Math.round((cat.base * jitter * sizeMul) / 10) * 10)
    const scale = Math.min(1, Math.max(0.25, +(10 / maxDim).toFixed(2)))
    const id = cat.id + '/' + f.replace(/\.vox$/i, '')
    const previewFile = `/models/store/previews/${id.replace(/\//g, '__')}.png`
    try {
      const png = renderIso(info.xyzi, info.pal, 96)
      if (png) writeFileSync(join(PREVIEWS, basename(previewFile)), png)
    } catch (e) { console.warn('preview gagal:', id, e.message) }
    items.push({
      id,
      name: titleize(basename(f)),
      cat: cat.id,
      file: '/' + relative(join(ROOT, '..', 'public'), abs).replace(/\\/g, '/'),
      preview: previewFile,
      price,
      minLv: cat.minLv,
      zone: ZONE_OVERRIDES[id] || 'land',
      scale,
      size: tight,
      voxels: info.xyzi.length
    })
  }
}

writeFileSync(OUT, JSON.stringify({ categories: CATEGORIES, items }, null, 2))
console.log(`catalog.json: ${items.length} item · preview: ${readdirSync(PREVIEWS).length} png`)
skipped.forEach(s => console.log(' ⚠ kosong/rusak:', s))
