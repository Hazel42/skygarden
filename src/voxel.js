import * as THREE from 'three'

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(x, y, s) {
  let n = (x * 374761393 + y * 668265263 + s * 1013904223) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  n = n ^ (n >>> 16)
  return (n >>> 0) / 4294967296
}

const smooth = t => t * t * (3 - 2 * t)

export function vnoise(x, z, seed = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed)
  const c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed)
  const u = smooth(xf), v = smooth(zf)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export class VoxelSystem {
  constructor() {
    this.solidMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
    this.winMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#FFCF9E').multiplyScalar(1.35),
      toneMapped: false, transparent: true, opacity: 0.4
    })
  }

  group(parent) { return new VoxelGroup(this, parent) }
}

export class VoxelGroup {
  constructor(sys, parent) {
    this.sys = sys
    this.group = new THREE.Group()
    if (parent) parent.add(this.group)
    this.meshes = []
    this.solid = []
    this.glow = []
  }

  add(x, y, z, hex, o = {}) {
    const item = { x, y, z, c: new THREE.Color(hex), s: o.size ?? 1 }
    if (o.win) this.solid.push(item), (item.win = true)
    else if (o.glow) this.glow.push(item)
    else this.solid.push(item)
  }

  box(x0, y0, z0, w, h, d, hex, o = {}) {
    for (let i = 0; i < w; i++)
      for (let j = 0; j < h; j++)
        for (let k = 0; k < d; k++) this.add(x0 + i, y0 + j, z0 + k, hex, o)
  }

  clear() {
    for (const m of this.meshes) {
      m.dispose()
      this.group.remove(m)
    }
    this.meshes.length = 0
  }

  destroy() {
    this.clear()
    if (this.group.parent) this.group.parent.remove(this.group)
  }

  _buildList(list, mat, ao) {
    if (!list.length) return
    const count = list.length
    const mesh = new THREE.InstancedMesh(UNIT_BOX, mat, count)
    const key = new Map()
    for (let i = 0; i < count; i++) {
      const it = list[i]
      key.set(it.x + ',' + it.y + ',' + it.z, true)
    }
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
    const tmp = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const it = list[i]
      let br = 1
      if (ao) {
        let n = 0, openTop = true
        for (const d of dirs) {
          if (key.has((it.x + d[0]) + ',' + (it.y + d[1]) + ',' + (it.z + d[2]))) {
            n++
            if (d[1] === 1) openTop = false
          }
        }
        br = 1 - n * 0.042 + (openTop ? 0.05 : 0)
      }
      const j = (hash2(Math.round(it.x * 7) | 0, Math.round(it.z * 13) | 0, (it.y * 3 + 77) | 0) - 0.5) * 0.085
      tmp.copy(it.c).multiplyScalar(br + j)
      mesh.setColorAt(i, tmp)
      _p.set(it.x, it.y, it.z)
      _s.setScalar(it.s)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.frustumCulled = false
    if (mat === this.sys.solidMat) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
    this.group.add(mesh)
    this.meshes.push(mesh)
  }

  build() {
    this.clear()
    const wins = this.solid.filter(i => i.win)
    const solid = this.solid.filter(i => !i.win)
    this._buildList(solid, this.sys.solidMat, true)
    this._buildList(wins, this.sys.winMat, false)
    this._buildList(this.glow, this.sys.glowMat, false)
  }
}
