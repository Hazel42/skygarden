export const PRESETS = [
  { label: '🌸 Pulau Sakura', prompt: 'Pohon Sakura di atas pulau melayang dengan air terjun, pilar kuno batu berlumut dan kelopak bunga pink berterbangan di udara' },
  { label: '🏰 Pulau Kastil', prompt: 'Pulau kastil batu melayang dengan menara, bendera, air terjun dan parit' },
  { label: '🍜 Kedai Cyberpunk', prompt: 'Kedai Ramen Cyberpunk malam hari dengan lampion merah dan papan neon berpendar' },
  { label: '⛩️ Kuil Torii', prompt: 'Kuil Jepang kuno dengan gerbang Torii merah, pohon Sakura dan kolam teratai' },
  { label: '🤖 Mech Robot', prompt: 'Robot Robotik Mech futuristik dengan pelindung dada, visor biru berpendar dan roket' },
  { label: '🪴 Pohon Bonsai', prompt: 'Pohon Bonsai Zen lekuk berlumut di atas pot keramik dengan lentera batu' },
  { label: '🍄 Hutan Jamur', prompt: 'Diorama jamur ajaib raksasa berpendar neon dengan kunang-kunang di rerumputan' }
]

const PROCEDURAL_KEYS = ['sakura', 'kastil', 'castle', 'cyberpunk', 'torii', 'mech', 'bonsai', 'jamur']

const hexToRgb = h => {
  h = String(h || '').replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  if (!Number.isFinite(n)) return [255, 255, 255]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const SHAPES_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      type: { type: 'STRING', enum: ['box', 'sphere', 'cylinder', 'cone'] },
      hexColor: { type: 'STRING' },
      x: { type: 'NUMBER', description: 'Center X (0.0 to 1.0)' },
      y: { type: 'NUMBER', description: 'Center Y (0.0 to 1.0)' },
      z: { type: 'NUMBER', description: 'Center Z (0.0 to 1.0)' },
      width: { type: 'NUMBER', description: 'Size in X (0.0 to 1.0)' },
      height: { type: 'NUMBER', description: 'Size in Y (0.0 to 1.0)' },
      depth: { type: 'NUMBER', description: 'Size in Z (0.0 to 1.0)' },
      isOrganic: { type: 'BOOLEAN', description: 'True for noisy/porous textures like leaves, fur, or clouds' }
    },
    required: ['type', 'hexColor', 'x', 'y', 'z', 'width', 'height', 'depth']
  }
}

async function callGemini(prompt, key) {
  const payload = {
    contents: [{
      parts: [{
        text: `Generate a 3D voxel art model of: "${prompt}". Compose this object using 15 to 40 primitive 3D shapes (box, sphere, cylinder, cone). The coordinate space is X, Y, Z from 0.0 to 1.0 (Y is up, 0.5 is center). Be creative and accurate with shapes, sizes, proportions, and colors to make it closely resemble the requested object.`
      }]
    }],
    systemInstruction: { parts: [{ text: 'You are an expert 3D Voxel Scene Composer. Return a JSON array of shapes.' }] },
    generationConfig: { responseMimeType: 'application/json', responseSchema: SHAPES_SCHEMA }
  }

  let lastErr = null
  for (const model of ['gemini-3-flash-preview', 'gemini-2.5-flash']) {
    let retries = 3
    let delay = 1000
    while (retries > 0) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        )
        if (!r.ok) {
          const e = new Error(`Gemini ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`)
          e.status = r.status
          throw e
        }
        const j = await r.json()
        const text = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
        const shapes = JSON.parse(text)
        if (!Array.isArray(shapes) || !shapes.length) throw new Error('AI tidak mengembalikan shape')
        return shapes.filter(s => s && s.type && Number.isFinite(+s.x))
      } catch (e) {
        lastErr = e
        if (e.status === 400 || e.status === 404) break
        retries--
        if (retries === 0) break
        await new Promise(res => setTimeout(res, delay))
        delay *= 2
      }
    }
  }
  throw lastErr || new Error('Gemini gagal')
}

function gridToModel(palHex, cellsMap, gs) {
  const voxels = []
  for (const [k, c] of cellsMap) {
    const [x, y, z] = k.split(',').map(Number)
    voxels.push({ x, y, z, i: c + 1 })
  }
  return { size: [gs, gs, gs], palette: palHex.map(hexToRgb), voxels }
}

export function rasterizeShapes(shapes, gs) {
  const cells = new Map()
  const palHex = []
  const palIdx = new Map()
  const idxOf = hex => {
    let i = palIdx.get(hex)
    if (i === undefined) {
      i = palHex.length
      palIdx.set(hex, i)
      palHex.push(hex)
    }
    return i
  }

  for (let x = 0; x < gs; x++) {
    for (let y = 0; y < gs; y++) {
      for (let z = 0; z < gs; z++) {
        const px = x / gs
        const py = y / gs
        const pz = z / gs

        for (let i = shapes.length - 1; i >= 0; i--) {
          const s = shapes[i]
          const dx = Math.abs(px - (+s.x))
          const dy = Math.abs(py - (+s.y))
          const dz = Math.abs(pz - (+s.z))
          const w = Math.max(+s.width || 0.01, 0.001)
          const h = Math.max(+s.height || 0.01, 0.001)
          const d = Math.max(+s.depth || 0.01, 0.001)

          let inside = false
          if (s.type === 'box') {
            if (dx <= w / 2 && dy <= h / 2 && dz <= d / 2) inside = true
          } else if (s.type === 'sphere') {
            const dist = (dx / w) ** 2 + (dy / h) ** 2 + (dz / d) ** 2
            if (dist <= 0.25) inside = true
          } else if (s.type === 'cylinder') {
            const distXZ = (dx / w) ** 2 + (dz / d) ** 2
            if (distXZ <= 0.25 && dy <= h / 2) inside = true
          } else if (s.type === 'cone') {
            const relY = (py - (+s.y - h / 2)) / h
            if (relY >= 0 && relY <= 1) {
              const maxRad = 1 - relY
              const distXZ = (dx / w) ** 2 + (dz / d) ** 2
              if (distXZ <= maxRad * maxRad * 0.25) inside = true
            }
          }

          if (inside) {
            if (s.isOrganic && Math.random() > 0.6) continue
            cells.set(x + ',' + y + ',' + z, idxOf(s.hexColor || '#ffffff'))
            break
          }
        }
      }
    }
  }

  if (!palHex.length) palHex.push('#6366f1')
  return gridToModel(palHex, cells, gs)
}

export function proceduralSakura(prompt, gs) {
  const p = prompt.toLowerCase()
  const palHex = [
    '#1e293b', '#2d3748', '#4a5568', '#718096',
    '#276749', '#38a169', '#48bb78',
    '#4299e1', '#63b3ed', '#ebf8ff',
    '#3c1f17', '#5c3224', '#844734', '#a8614c',
    '#97266d', '#b83280', '#d53f8c', '#ed64a6', '#fbb6ce', '#ffffff'
  ]
  const V = []
  const mid = Math.floor(gs / 2)
  const isDiorama = p.includes('pulau') || p.includes('island') || p.includes('melayang') || p.includes('floating') || p.includes('diorama')
  const hasWater = p.includes('air') || p.includes('water') || p.includes('terjun') || p.includes('sungai')
  const hasPetals = p.includes('gugur') || p.includes('terbang') || p.includes('angin') || p.includes('kelopak') || p.includes('berterbangan') || p.includes('udara')
  const hasRuins = p.includes('batu') || p.includes('pilar') || p.includes('kuno') || p.includes('ruin') || p.includes('candi')

  const groundY = Math.floor(gs * 0.28)

  if (isDiorama) {
    for (let y = 0; y <= groundY; y++) {
      const progress = y / groundY
      const maxR = (mid - 3) * Math.pow(progress, 0.7)
      for (let x = 0; x < gs; x++) {
        for (let z = 0; z < gs; z++) {
          const dist = Math.hypot(x - mid, z - mid)
          const noise = Math.sin(x * 0.4) * Math.cos(z * 0.4) * 1.8 + Math.sin((x + y) * 0.6) * 1.2
          if (dist <= maxR + noise) {
            if (y === groundY) {
              V.push({ x, y, z, colorIndex: dist > maxR - 1.8 ? 4 : 5 })
            } else {
              const isDeep = y < groundY * 0.4 || dist < maxR * 0.4
              V.push({ x, y, z, colorIndex: isDeep ? 0 : (dist > maxR - 1.2 ? 1 : 2) })
            }
          }
        }
      }
    }

    const vineCount = Math.floor(gs * 0.8)
    for (let i = 0; i < vineCount; i++) {
      const angle = (i / vineCount) * Math.PI * 2
      const r = (mid - 4) + Math.sin(i * 3) * 1.5
      const vx = Math.round(mid + Math.cos(angle) * r)
      const vz = Math.round(mid + Math.sin(angle) * r)
      const vineLen = Math.floor(Math.random() * (gs * 0.2)) + 3
      for (let vy = groundY - 1; vy >= groundY - vineLen; vy--) {
        if (vy >= 0 && vx >= 0 && vx < gs && vz >= 0 && vz < gs) V.push({ x: vx, y: vy, z: vz, colorIndex: 4 })
      }
    }

    for (let s = 0; s < 14; s++) {
      const sa = (s / 14) * Math.PI * 2
      const sr = mid - 2 + (s % 3)
      const sx = Math.round(mid + Math.cos(sa) * sr)
      const sz = Math.round(mid + Math.sin(sa) * sr)
      const sy = Math.floor(Math.random() * (groundY * 0.6))
      if (sx >= 0 && sx < gs && sz >= 0 && sz < gs) V.push({ x: sx, y: sy, z: sz, colorIndex: 1 })
    }
  } else {
    for (let y = groundY - 4; y <= groundY; y++) {
      const progress = (y - (groundY - 4)) / 4
      const maxR = (mid - 8) + progress * 5
      for (let x = 0; x < gs; x++) {
        for (let z = 0; z < gs; z++) {
          const dist = Math.hypot(x - mid, z - mid)
          const noise = (Math.sin(x * 0.6) + Math.cos(z * 0.6)) * 1.2
          if (dist <= maxR + noise) {
            const isMoss = y === groundY || (y === groundY - 1 && dist > maxR - 1.5)
            V.push({ x, y, z, colorIndex: isMoss ? 5 : (dist > maxR - 1.5 ? 4 : 1) })
          }
        }
      }
    }
  }

  if (hasWater && isDiorama) {
    const wfZ = mid + Math.floor(mid * 0.45)
    for (let wy = groundY; wy >= 1; wy--) {
      const width = wy === 1 ? 4 : 2
      for (let wx = mid - width; wx <= mid + width; wx++) {
        if (wx >= 0 && wx < gs && wfZ >= 0 && wfZ < gs) {
          V.push({ x: wx, y: wy, z: wfZ, colorIndex: wy <= 2 || Math.abs(wx - mid) === width ? 9 : 8 })
        }
      }
    }
  }

  if (hasRuins) {
    const ruins = [
      [mid - Math.floor(gs * 0.25), mid - Math.floor(gs * 0.15)],
      [mid + Math.floor(gs * 0.25), mid - Math.floor(gs * 0.1)]
    ]
    for (const [rx, rz] of ruins) {
      const height = Math.floor(gs * 0.18)
      for (let ry = groundY + 1; ry <= groundY + height; ry++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (Math.abs(dx) + Math.abs(dz) <= 1) V.push({ x: rx + dx, y: ry, z: rz + dz, colorIndex: 3 })
          }
        }
      }
    }
  }

  const trunkStartY = groundY + 1
  const trunkHeight = Math.floor(gs * 0.38)
  const branchSplines = []

  for (let a = 0; a < 6; a++) {
    const ra = (a / 6) * Math.PI * 2
    const rLen = Math.floor(gs * 0.12)
    for (let step = 1; step <= rLen; step++) {
      const rx = Math.round(mid + Math.cos(ra) * step)
      const rz = Math.round(mid + Math.sin(ra) * step)
      const ry = groundY + 1 - Math.floor(step * 0.3)
      if (rx >= 0 && rx < gs && rz >= 0 && rz < gs && ry >= groundY) V.push({ x: rx, y: ry, z: rz, colorIndex: 10 })
    }
  }

  for (let ty = trunkStartY; ty <= trunkStartY + trunkHeight; ty++) {
    const prog = (ty - trunkStartY) / trunkHeight
    const cx = mid + Math.round(Math.sin(prog * Math.PI * 1.4) * (gs * 0.08))
    const cz = mid + Math.round(Math.cos(prog * Math.PI * 1.1) * (gs * 0.06))
    const radius = Math.max(1, Math.round((1 - prog * 0.6) * (gs * 0.06)))
    for (let tx = cx - radius; tx <= cx + radius; tx++) {
      for (let tz = cz - radius; tz <= cz + radius; tz++) {
        if (Math.hypot(tx - cx, tz - cz) <= radius) {
          V.push({ x: tx, y: ty, z: tz, colorIndex: tx === cx + 1 || tz === cz + 1 ? 12 : 11 })
        }
      }
    }
    if (ty >= trunkStartY + Math.floor(trunkHeight * 0.45)) branchSplines.push({ x: cx, y: ty, z: cz })
  }

  const mainBranchDirs = [
    { dx: -gs * 0.22, dy: gs * 0.18, dz: -gs * 0.15, radius: gs * 0.22 },
    { dx: gs * 0.24, dy: gs * 0.20, dz: -gs * 0.10, radius: gs * 0.24 },
    { dx: -gs * 0.18, dy: gs * 0.22, dz: gs * 0.18, radius: gs * 0.20 },
    { dx: gs * 0.20, dy: gs * 0.25, dz: gs * 0.16, radius: gs * 0.22 },
    { dx: 0, dy: gs * 0.28, dz: 0, radius: gs * 0.28 }
  ]

  const blossomCenters = []
  for (const b of mainBranchDirs) {
    const startP = branchSplines[Math.floor(branchSplines.length * 0.6)] || { x: mid, y: trunkStartY + trunkHeight, z: mid }
    const endX = Math.min(gs - 3, Math.max(2, Math.round(startP.x + b.dx)))
    const endY = Math.min(gs - 2, Math.round(startP.y + b.dy))
    const endZ = Math.min(gs - 3, Math.max(2, Math.round(startP.z + b.dz)))

    for (let s = 0; s <= 6; s++) {
      const bx = Math.round(startP.x + (endX - startP.x) * (s / 6))
      const by = Math.round(startP.y + (endY - startP.y) * (s / 6))
      const bz = Math.round(startP.z + (endZ - startP.z) * (s / 6))
      if (bx >= 0 && bx < gs && by >= 0 && by < gs && bz >= 0 && bz < gs) V.push({ x: bx, y: by, z: bz, colorIndex: 12 })
    }
    blossomCenters.push({ x: endX, y: endY, z: endZ, radius: b.radius })
  }

  for (const bc of blossomCenters) {
    const r = bc.radius
    const minX = Math.max(0, Math.floor(bc.x - r))
    const maxX = Math.min(gs - 1, Math.ceil(bc.x + r))
    const minY = Math.max(0, Math.floor(bc.y - r * 0.8))
    const maxY = Math.min(gs - 1, Math.ceil(bc.y + r * 0.9))
    const minZ = Math.max(0, Math.floor(bc.z - r))
    const maxZ = Math.min(gs - 1, Math.ceil(bc.z + r))

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const dist = Math.hypot(x - bc.x, (y - bc.y) * 1.25, z - bc.z)
          const noise = (Math.sin(x * 0.5) + Math.cos(y * 0.5) + Math.sin(z * 0.5)) * 0.8
          if (dist + noise <= r) {
            const heightRel = (y - (bc.y - r)) / (r * 1.8)
            let colorIdx = 16
            if (heightRel > 0.82) colorIdx = 19
            else if (heightRel > 0.6) colorIdx = 18
            else if (heightRel > 0.35) colorIdx = 17
            else if (heightRel > 0.18) colorIdx = 16
            else colorIdx = 14
            V.push({ x, y, z, colorIndex: colorIdx })
          }
        }
      }
    }
  }

  if (hasPetals) {
    const petalCount = Math.floor(gs * 4)
    for (let i = 0; i < petalCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = gs * 0.15 + Math.random() * gs * 0.35
      const px = Math.round(mid + Math.cos(angle) * radius)
      const py = Math.round(groundY + 2 + Math.random() * gs * 0.5)
      const pz = Math.round(mid + Math.sin(angle) * radius)
      if (px >= 0 && px < gs && py >= 0 && py < gs && pz >= 0 && pz < gs) V.push({ x: px, y: py, z: pz, colorIndex: 18 })
    }
  }

  const cells = new Map()
  for (const v of V) cells.set(v.x + ',' + v.y + ',' + v.z, v.colorIndex)
  return gridToModel(palHex, cells, gs)
}

export function proceduralCastle(prompt, gs) {
  void prompt
  const palHex = ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#166534', '#22c55e', '#0284c7', '#38bdf8', '#dc2626', '#f59e0b']
  const V = []
  const mid = Math.floor(gs / 2)
  const groundY = Math.floor(gs * 0.25)

  for (let y = 0; y <= groundY; y++) {
    const r = Math.floor((y / groundY) * (mid - 4)) + 2
    for (let x = mid - r; x <= mid + r; x++) {
      for (let z = mid - r; z <= mid + r; z++) {
        if (Math.hypot(x - mid, z - mid) <= r) V.push({ x, y, z, colorIndex: y === groundY ? 5 : 1 })
      }
    }
  }
  for (let y = groundY + 1; y <= groundY + Math.floor(gs * 0.25); y++) {
    const size = Math.floor(gs * 0.2)
    for (let x = mid - size; x <= mid + size; x++) {
      for (let z = mid - size; z <= mid + size; z++) {
        const isEdge = x === mid - size || x === mid + size || z === mid - size || z === mid + size
        if (isEdge || y === groundY + 1) V.push({ x, y, z, colorIndex: 3 })
      }
    }
  }

  const cells = new Map()
  for (const v of V) cells.set(v.x + ',' + v.y + ',' + v.z, v.colorIndex)
  return gridToModel(palHex, cells, gs)
}

export function proceduralGeneric(prompt, gs) {
  void prompt
  const palHex = ['#6366f1', '#4f46e5', '#4338ca', '#818cf8', '#a5b4fc', '#f43f5e', '#10b981', '#f59e0b']
  const V = []
  const mid = Math.floor(gs / 2)
  const rMax = Math.floor(gs * 0.35)

  for (let y = 2; y <= Math.floor(gs * 0.6); y++) {
    const r = Math.floor((1 - Math.abs(y - gs * 0.3) / (gs * 0.3)) * rMax) + 1
    for (let x = mid - r; x <= mid + r; x++) {
      for (let z = mid - r; z <= mid + r; z++) {
        if (Math.hypot(x - mid, z - mid) <= r) V.push({ x, y, z, colorIndex: (x + y + z) % palHex.length })
      }
    }
  }

  const cells = new Map()
  for (const v of V) cells.set(v.x + ',' + v.y + ',' + v.z, v.colorIndex)
  return gridToModel(palHex, cells, gs)
}

export function generateProcedural(prompt, gs) {
  const p = prompt.toLowerCase()
  if (p.includes('sakura') || p.includes('pohon') || p.includes('tree') || p.includes('bunga')) {
    return proceduralSakura(prompt, gs)
  }
  if (p.includes('kastil') || p.includes('castle') || p.includes('pulau')) {
    return proceduralCastle(prompt, gs)
  }
  return proceduralGeneric(prompt, gs)
}

export function isProceduralPrompt(prompt) {
  const p = prompt.toLowerCase()
  return PROCEDURAL_KEYS.some(k => p.includes(k))
}

export async function generateVoxelModel({ prompt, gridSize, keys }) {
  if (isProceduralPrompt(prompt)) {
    return { model: generateProcedural(prompt, gridSize), source: 'procedural' }
  }
  if (!keys.gemini) {
    throw new Error('Prompt bebas butuh Gemini API key (🔑) — atau pakai preset prosedural.')
  }
  const shapes = await callGemini(prompt, keys.gemini)
  return { model: rasterizeShapes(shapes, gridSize), source: 'gemini' }
}

export function enhancePrompt(prompt) {
  const current = (prompt || '').trim() || 'Pohon Sakura'
  return `${current} di atas pulau melayang dengan air terjun, pilar kuno batu berlumut dan kelopak bunga pink berterbangan di udara`
}

export function loadKeys(env = {}) {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem('forge-keys-v1') || '{}') } catch (e) { }
  return {
    gemini: saved.gemini || env.VITE_GEMINI_API_KEY || '',
    model: saved.model || ''
  }
}

export function saveKeys(keys) {
  localStorage.setItem('forge-keys-v1', JSON.stringify(keys))
}
