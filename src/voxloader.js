import * as THREE from 'three'

export function parseVox(buffer) {
  const dv = new DataView(buffer)
  const u8 = new Uint8Array(buffer)
  let off = 0
  const tag = () => { const t = String.fromCharCode(...u8.subarray(off, off + 4)); off += 4; return t }
  const u32 = () => { const v = dv.getUint32(off, true); off += 4; return v }

  if (tag() !== 'VOX ') throw new Error('not a .vox file')
  u32()
  if (tag() !== 'MAIN') throw new Error('missing MAIN chunk')
  u32()
  const childrenEnd = off + u32()

  let size = null
  let voxels = []
  let palette = null

  while (off < childrenEnd) {
    const id = tag()
    const contentSize = u32()
    const childSize = u32()
    if (id === 'SIZE') {
      size = [dv.getUint32(off, true), dv.getUint32(off + 4, true), dv.getUint32(off + 8, true)]
    } else if (id === 'XYZI') {
      const n = dv.getUint32(off, true)
      voxels = new Array(n)
      for (let i = 0; i < n; i++) {
        const p = off + 4 + i * 4
        voxels[i] = { x: u8[p], y: u8[p + 1], z: u8[p + 2], i: u8[p + 3] }
      }
    } else if (id === 'RGBA') {
      palette = []
      for (let i = 0; i < 255; i++) {
        palette.push([u8[off + i * 4], u8[off + i * 4 + 1], u8[off + i * 4 + 2]])
      }
    }
    off += contentSize + childSize
  }
  if (!size) throw new Error('missing SIZE chunk')
  return { size, voxels, palette }
}

const colorFor = (palette, idx) => {
  if (palette && idx >= 1 && idx <= 255) {
    const c = palette[idx - 1]
    return [(c[0] || 0) / 255, (c[1] || 0) / 255, (c[2] || 0) / 255]
  }
  const h = (idx * 0.618) % 1
  return [0.35 + h * 0.5, 0.35 + ((h * 7) % 1) * 0.5, 0.4 + ((h * 13) % 1) * 0.45]
}

const luma = c => c[0] * 0.55 + c[1] * 0.6 + c[2] * 0.25

export async function loadVoxAsset(url, { scale = 1 } = {}) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`)
  const buf = await res.arrayBuffer()
  const { size, voxels, palette } = parseVox(buf)
  const ox = (size[0] - 1) / 2
  const oz = (size[2] - 1) / 2

  const solid = []
  const glow = []
  for (const v of voxels) {
    if (!v.i) continue
    ;(luma(colorFor(palette, v.i)) >= 0.83 ? glow : solid).push(v)
  }

  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(scale, scale, scale)
  const m4 = new THREE.Matrix4()

  const build = (list, mat) => {
    if (!list.length) return null
    const mesh = new THREE.InstancedMesh(geo, mat, list.length)
    list.forEach((v, k) => {
      m4.makeTranslation((v.x - ox) * scale, v.y * scale, (v.z - oz) * scale)
      mesh.setMatrixAt(k, m4)
      const c = colorFor(palette, v.i)
      mesh.setColorAt(k, new THREE.Color(c[0], c[1], c[2]))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    group.add(mesh)
    return mesh
  }

  build(solid, new THREE.MeshLambertMaterial())
  build(glow, new THREE.MeshBasicMaterial({ toneMapped: false }))
  return group
}

export function centerBottom(group, sizeX, sizeZ, scale = 1) {
  group.position.x -= (sizeX - 1) * scale / 2
  group.position.z -= (sizeZ - 1) * scale / 2
  return group
}
