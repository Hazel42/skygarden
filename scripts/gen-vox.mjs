import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models')

class VoxModel {
  constructor(x, y, z) {
    this.size = [x, y, z]
    this.cells = new Map()
    this.palette = []
  }
  idx(r, g, b) {
    const found = this.palette.findIndex(p => p[0] === r && p[1] === g && p[2] === b)
    if (found >= 0) return found + 1
    this.palette.push([r, g, b])
    return this.palette.length
  }
  set(x, y, z, ci) {
    if (ci < 1) { this.cells.delete(`${x},${y},${z}`); return }
    if (x < 0 || y < 0 || z < 0 || x >= this.size[0] || y >= this.size[1] || z >= this.size[2]) return
    this.cells.set(`${x},${y},${z}`, ci)
  }
  box(x0, y0, z0, x1, y1, z1, ci) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, ci)
  }
}

function writeVox(filePath, model) {
  const chunks = []
  const enc = s => Buffer.from(s, 'ascii')
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }

  const sizeBody = Buffer.concat(model.size.map(u32))
  chunks.push(Buffer.concat([enc('SIZE'), u32(12), u32(0), sizeBody]))

  const voxels = [...model.cells.entries()].map(([k, ci]) => {
    const [x, y, z] = k.split(',').map(Number)
    return Buffer.from([x, y, z, ci])
  })
  const xyziBody = Buffer.concat([u32(voxels.length), ...voxels])
  chunks.push(Buffer.concat([enc('XYZI'), u32(xyziBody.length), u32(0), xyziBody]))

  const palRows = model.palette.slice(0, 255).map(([r, g, b]) => Buffer.from([r, g, b, 255]))
  while (palRows.length < 255) palRows.push(Buffer.from([0, 0, 0, 0]))
  const rgbaBody = Buffer.concat(palRows)
  chunks.push(Buffer.concat([enc('RGBA'), u32(rgbaBody.length), u32(0), rgbaBody]))

  const childrenSize = chunks.reduce((n, c) => n + c.length, 0)
  const main = Buffer.concat([enc('VOX '), u32(150), enc('MAIN'), u32(0), u32(childrenSize), ...chunks])
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, main)
  console.log(`✓ ${filePath} (${model.cells.size} voxels, ${model.palette.length} colors)`)
}

// ---------------- Torii Gate (13 x 11 x 3) ----------------
{
  const m = new VoxModel(13, 11, 3)
  const RED = m.idx(208, 52, 44)
  const DARKRED = m.idx(150, 34, 30)
  const DARK = m.idx(43, 43, 49)
  const GOLD = m.idx(232, 184, 75)

  for (const px of [1, 2, 10, 11]) m.box(px, 0, 1, px, 8, 1, RED)
  m.box(1, 0, 0, 2, 0, 2, DARK)
  m.box(10, 0, 0, 11, 0, 2, DARK)
  m.box(0, 6, 1, 12, 6, 1, RED)
  m.set(6, 7, 1, DARKRED); m.set(6, 8, 1, DARKRED)
  m.box(0, 9, 1, 12, 9, 1, RED)
  m.box(1, 10, 1, 11, 10, 1, DARK)
  m.set(0, 9, 0, DARK); m.set(12, 9, 0, DARK); m.set(0, 9, 2, DARK); m.set(12, 9, 2, DARK)
  m.set(0, 10, 1, GOLD); m.set(12, 10, 1, GOLD)
  writeVox(join(OUT, 'torii_gate.vox'), m)
}

// ---------------- Lantern Arch (11 x 8 x 3) ----------------
{
  const m = new VoxModel(11, 8, 3)
  const STONE = m.idx(146, 142, 134)
  const STONE_D = m.idx(104, 100, 94)
  const ROPE = m.idx(110, 78, 46)
  const GLOW = m.idx(255, 214, 130)
  const GLOW2 = m.idx(255, 240, 190)

  for (const px of [1, 9]) {
    m.box(px - 1, 0, 1, px + 1, 0, 1, STONE_D)
    m.box(px, 1, 1, px, 4, 1, STONE)
    m.set(px, 2, 1, STONE_D)
    m.box(px - 1, 5, 1, px + 1, 5, 1, GLOW)
  }
  m.box(3, 6, 1, 7, 6, 1, ROPE)
  for (const lx of [3, 5, 7]) {
    m.set(lx, 5, 1, ROPE)
    m.set(lx, 4, 1, GLOW2)
  }
  writeVox(join(OUT, 'lantern_arch.vox'), m)
}

// ---------------- Stone Pagoda (9 x 15 x 9) ----------------
{
  const m = new VoxModel(9, 15, 9)
  const BODY = m.idx(196, 188, 172)
  const BODY_D = m.idx(150, 142, 126)
  const ROOF = m.idx(74, 84, 96)
  const ROOF_L = m.idx(98, 112, 128)
  const GLOW = m.idx(255, 224, 150)
  const GOLD = m.idx(226, 178, 88)

  let y = 0
  const tiers = [[9, 3], [7, 2], [5, 2], [4, 2], [3, 2]]
  for (let t = 0; t < tiers.length; t++) {
    const [w, h] = tiers[t]
    const off = Math.floor((9 - w) / 2)
    const roofOver = w < 9 ? 1 : 0
    m.box(off, y, off, 8 - off, y, 8 - off, BODY_D)
    m.box(off + 1, y + 1, off + 1, 8 - off - 1, y + h - 1, 8 - off - 1, BODY)
    const cx = 4, cz = 4
    if (t < tiers.length - 1) {
      m.box(cx, y + 1, cz, cx, y + h - 1, cz, GLOW)
    } else {
      m.set(cx, y + 1, cz, GLOW)
    }
    const ry = y + h
    m.box(off - roofOver, ry, off - roofOver, 8 - off + roofOver, ry, 8 - off + roofOver, ROOF)
    m.box(off - roofOver + 1, ry + 1, off - roofOver + 1, 8 - off + roofOver - 1, ry + 1, 8 - off + roofOver - 1, ROOF_L)
    y = ry + 2
  }
  m.set(4, y, 4, GOLD)
  m.set(4, y - 1, 4, GOLD)
  writeVox(join(OUT, 'stone_pagoda.vox'), m)
}

// ---------------- Pond Bridge (9 x 5 x 3) — melengkung di atas kolam ----------------
{
  const m = new VoxModel(9, 5, 3)
  const RED = m.idx(208, 52, 44)
  const DARKRED = m.idx(150, 34, 30)
  const WOOD = m.idx(140, 96, 60)
  const GOLD = m.idx(232, 184, 75)

  const arch = [0, 1, 2, 2, 2, 2, 2, 1, 0]
  for (let x = 0; x < 9; x++) {
    const y = arch[x]
    m.box(x, y, 1, x, y, 1, WOOD)
    if (x === 0 || x === 8) m.box(x, y, 0, x, y, 2, DARKRED)
    if (x % 2 === 0 && x > 0 && x < 8) {
      m.set(x, y + 1, 0, RED)
      m.set(x, y + 1, 2, RED)
      if (x === 2 || x === 6) {
        m.set(x, y + 2, 0, GOLD)
        m.set(x, y + 2, 2, GOLD)
      }
    }
  }
  m.box(0, 1, 1, 0, 1, 1, DARKRED)
  m.box(8, 1, 1, 8, 1, 1, DARKRED)
  writeVox(join(OUT, 'pond_bridge.vox'), m)
}

// ---------------- Golden Torii (9 x 10 x 2) — gerbang path selatan ----------------
{
  const m = new VoxModel(9, 10, 2)
  const GOLD = m.idx(232, 184, 75)
  const GOLD_D = m.idx(178, 132, 44)
  const RED = m.idx(208, 52, 44)

  for (const px of [1, 7]) m.box(px, 0, 0, px, 7, 0, GOLD)
  m.box(0, 7, 0, 8, 7, 0, GOLD)
  m.box(1, 8, 0, 7, 8, 0, GOLD_D)
  m.box(0, 9, 0, 8, 9, 0, GOLD)
  m.set(0, 9, 1, RED); m.set(8, 9, 1, RED)
  m.box(4, 5, 0, 4, 6, 0, GOLD_D)
  for (const px of [1, 7]) m.set(px, 0, 1, GOLD_D)
  writeVox(join(OUT, 'golden_torii.vox'), m)
}

// ---------------- Shrine (7 x 6 x 7) — kuil kecil stage tinggi ----------------
{
  const m = new VoxModel(7, 6, 7)
  const STONE = m.idx(146, 142, 134)
  const WOOD = m.idx(140, 96, 60)
  const WOOD_D = m.idx(96, 64, 40)
  const ROOF = m.idx(74, 84, 96)
  const GOLD = m.idx(232, 184, 75)
  const GLOW = m.idx(255, 224, 150)

  m.box(0, 0, 0, 6, 0, 6, STONE)
  m.box(1, 1, 1, 5, 2, 5, WOOD)
  for (const [px, pz] of [[1, 1], [5, 1], [1, 5], [5, 5]])
    m.box(px, 1, pz, px, 3, pz, WOOD_D)
  m.box(3, 1, 5, 3, 2, 5, GLOW)
  m.box(0, 4, 0, 6, 4, 6, ROOF)
  m.box(1, 5, 1, 5, 5, 5, ROOF)
  m.set(3, 5, 0, GOLD); m.set(3, 5, 6, GOLD)
  m.set(0, 5, 3, GOLD); m.set(6, 5, 3, GOLD)
  m.set(3, 6, 3, GOLD)
  for (const [lx, lz] of [[0, 3], [6, 3]]) m.set(lx, 3, lz, GLOW)
  writeVox(join(OUT, 'shrine.vox'), m)
}

console.log('done')
