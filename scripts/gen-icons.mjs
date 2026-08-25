import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = join(ROOT, '..', 'public', 'icons')

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
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// pagoda piksel 16 kolom
const ROWS = [
  '',
  '',
  '..WWWW..........',
  '.......WW.......',
  '...WWWWWWWW.....',
  '......WW........',
  '..WWWWWWWWWW....',
  '.....WWWW.......',
  '.WWWWWWWWWWWW...',
  '.....WWWW.......',
  '.....WWWW.......',
  '.....WWWW.......',
  '...WWWWWWWW.....',
  '................',
  '................',
  '................'
]

const lerp = (a, b, t) => a + (b - a) * t
const cA = [67, 56, 202], cB = [124, 58, 237], cC = [236, 72, 153]

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const cell = size / 16
  const put = (px, py, r, g, b, a = 255) => {
    if (px < 0 || py < 0 || px >= size || py >= size) return
    const o = (py * size + px) * 4
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a
  }
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const gx = px / cell, gy = py / cell
      const t = Math.min(1, (gx + gy) / 30)
      let r, g, b
      if (t < 0.5) { const k = t / 0.5; r = lerp(cA[0], cB[0], k); g = lerp(cA[1], cB[1], k); b = lerp(cA[2], cB[2], k) }
      else { const k = (t - 0.5) / 0.5; r = lerp(cB[0], cC[0], k); g = lerp(cB[1], cC[1], k); b = lerp(cB[2], cC[2], k) }
      put(px, py, r, g, b)
    }
  }
  ROWS.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] !== 'W') continue
      const x0 = Math.floor(rx * cell), x1 = Math.floor((rx + 1) * cell)
      const y0 = Math.floor(ry * cell), y1 = Math.floor((ry + 1) * cell)
      for (let py = y0; py < y1; py++)
        for (let px = x0; px < x1; px++)
          put(px, py, 255, 247, 240)
    }
  })
  return pngEncode(size, size, rgba)
}

mkdirSync(OUT, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), drawIcon(size))
  console.log(`icon-${size}.png ditulis`)
}
