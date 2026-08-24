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

const FACES = [
  { dir: [-1, 0, 0], tint: 0.96, corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
  { dir: [1, 0, 0], tint: 0.96, corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
  { dir: [0, -1, 0], tint: 0.84, corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], tint: 1.05, corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { dir: [0, 0, -1], tint: 0.99, corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, 0, 1], tint: 1.0, corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] }
]

const AO_LUT = [0.55, 0.72, 0.87, 1.0]
const UVC = [[0, 1], [0, 0], [1, 1], [1, 0]]

export const voxelUniforms = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  uNight: { value: 0 },
  uTint: { value: new THREE.Color(1, 1, 1) },
  uSssColor: { value: new THREE.Color(1.0, 0.62, 0.35) }
}

export function createVoxelSolidMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, voxelUniforms)
    sh.vertexShader = `
attribute float aSway;
attribute float aSss;
attribute vec3 snorm;
attribute vec2 aUv;
varying vec3 vSnorm;
varying vec2 vVoxUv;
varying float vSss;
varying vec3 vWpos;
uniform float uTime;
` + sh.vertexShader
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
float swv = aSway * ( 0.5 + 0.5 * sin( uTime * 1.6 + position.x * 0.12 + position.z * 0.09 + position.y * 0.05 ) );
transformed.x += swv * 0.12;
transformed.z += swv * 0.09;
transformed.y -= swv * 0.04;
vSnorm = snorm;
vVoxUv = aUv;
vSss = aSss;
vWpos = position;`)
    sh.fragmentShader = `
varying vec3 vSnorm;
varying vec2 vVoxUv;
varying float vSss;
varying vec3 vWpos;
uniform float uNight;
uniform vec3 uTint;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSssColor;
` + sh.fragmentShader
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= uTint;`)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
float bmask = smoothstep( 0.0, 0.16, min( min( vVoxUv.x, 1.0 - vVoxUv.x ), min( vVoxUv.y, 1.0 - vVoxUv.y ) ) );
normal = normalize( mix( vSnorm, normal, bmask ) );`)
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec3 vdir = normalize( vWpos - cameraPosition );
float back = pow( max( dot( vdir, uSunDir ), 0.0 ), 3.0 );
totalEmissiveRadiance += uSssColor * vSss * back * ( 0.3 + 0.7 * length( uSunColor ) );
totalEmissiveRadiance += uSssColor * vSss * 0.05 * uNight;`)
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
float vfh = smoothstep( fogNear, fogFar, vFogDepth );
vfh = clamp( vfh + ( 1.0 - smoothstep( -5.0, 8.0, vWpos.y ) ) * 0.38 * ( 1.0 - vfh ), 0.0, 1.0 );
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, vfh );
#endif`)
  }
  mat.customProgramCacheKey = () => 'voxel-solid-v1'
  return mat
}

const _col = new THREE.Color()

export function buildVoxelGeometry(list, opts = {}) {
  if (!list.length) return null
  let occupancy = opts.occupancy
  if (!occupancy) {
    occupancy = new Map()
    for (const it of list) occupancy.set(it.x + ',' + it.y + ',' + it.z, it)
  }
  const useAO = opts.ao !== false
  const flat = !!opts.flat
  const positions = []
  const normals = []
  const colors = []
  const indices = []
  const snorm = []
  const uvArr = []
  const swayArr = []
  const sssArr = []

  for (const it of list) {
    const s = it.s ?? 1
    _col.set(it.c)
    const jx = it.x, jz = it.z, jy = it.y
    const jb = (hash2(Math.round(jx * 7) | 0, Math.round(jz * 13) | 0, (jy * 3 + 77) | 0) - 0.5) * 0.08
    _col.offsetHSL((hash2(Math.round(jx * 3) | 0, Math.round(jz * 5) | 0, (jy * 7 + 31) | 0) - 0.5) * 0.02, (jb * 0.4), jb)

    const dn = [0, 0, 0]
    for (const f of FACES) {
      const nk0 = (it.x + f.dir[0]) + ',' + (it.y + f.dir[1]) + ',' + (it.z + f.dir[2])
      if (!occupancy.has(nk0)) {
        dn[0] += f.dir[0]; dn[1] += f.dir[1]; dn[2] += f.dir[2]
      }
    }
    const dl = Math.hypot(dn[0], dn[1], dn[2])
    const sn = dl > 0.001 ? [dn[0] / dl, dn[1] / dl, dn[2] / dl] : null

    for (const f of FACES) {
      const nk = (it.x + f.dir[0]) + ',' + (it.y + f.dir[1]) + ',' + (it.z + f.dir[2])
      if (occupancy.has(nk)) continue

      const base = positions.length / 3
      const aos = [1, 1, 1, 1]

      if (useAO && s === 1 && !flat) {
        const axis = f.dir[0] !== 0 ? 0 : f.dir[1] !== 0 ? 1 : 2
        const t1 = (axis + 1) % 3, t2 = (axis + 2) % 3
        const b = [it.x + f.dir[0], it.y + f.dir[1], it.z + f.dir[2]]
        for (let ci = 0; ci < 4; ci++) {
          const c = f.corners[ci]
          const sg1 = c[t1] ? 1 : -1
          const sg2 = c[t2] ? 1 : -1
          const p1 = [b[0], b[1], b[2]]; p1[t1] += sg1
          const p2 = [b[0], b[1], b[2]]; p2[t2] += sg2
          const pc = [b[0], b[1], b[2]]; pc[t1] += sg1; pc[t2] += sg2
          const s1 = occupancy.has(p1.join(',')) ? 1 : 0
          const s2 = occupancy.has(p2.join(',')) ? 1 : 0
          const cc = occupancy.has(pc.join(',')) ? 1 : 0
          aos[ci] = AO_LUT[(s1 && s2) ? 0 : 3 - (s1 + s2 + cc)]
        }
      }

      for (let ci = 0; ci < 4; ci++) {
        const c = f.corners[ci]
        positions.push(
          it.x + (c[0] - 0.5) * s,
          it.y + (c[1] - 0.5) * s,
          it.z + (c[2] - 0.5) * s
        )
        normals.push(f.dir[0], f.dir[1], f.dir[2])
        const v = flat ? 1.12 : f.tint * aos[ci]
        colors.push(_col.r * v, _col.g * v, _col.b * v)
        const snv = sn || f.dir
        snorm.push(snv[0], snv[1], snv[2])
        uvArr.push(UVC[ci][0], UVC[ci][1])
        swayArr.push(it.sway || 0)
        sssArr.push(it.sss || 0)
      }

      if (aos[0] + aos[3] > aos[1] + aos[2]) {
        indices.push(base, base + 1, base + 3, base, base + 3, base + 2)
      } else {
        indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3)
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setAttribute('snorm', new THREE.Float32BufferAttribute(snorm, 3))
  geo.setAttribute('aUv', new THREE.Float32BufferAttribute(uvArr, 2))
  geo.setAttribute('aSway', new THREE.Float32BufferAttribute(swayArr, 1))
  geo.setAttribute('aSss', new THREE.Float32BufferAttribute(sssArr, 1))
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1))
  geo.computeBoundingSphere()
  return geo
}

export class VoxelSystem {
  constructor() {
    this.solidMat = createVoxelSolidMaterial()
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false })
    this.winMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#FFCF9E').multiplyScalar(1.35),
      toneMapped: false, transparent: true, opacity: 0.4, vertexColors: true
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
    const item = {
      x, y, z, c: new THREE.Color(hex), s: o.size ?? 1,
      sway: o.sway ?? 0, sss: o.sss ?? 0
    }
    if (o.win) { item.win = true; this.solid.push(item) }
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
      m.geometry.dispose()
      this.group.remove(m)
    }
    this.meshes.length = 0
  }

  destroy() {
    this.clear()
    if (this.group.parent) this.group.parent.remove(this.group)
  }

  _mesh(list, mat, ao, flat, occ) {
    if (!list.length) return
    const geo = buildVoxelGeometry(list, { ao, flat, occupancy: occ })
    if (!geo) return
    const mesh = new THREE.Mesh(geo, mat)
    const isSolid = mat === this.sys.solidMat
    mesh.castShadow = isSolid
    mesh.receiveShadow = isSolid
    mesh.frustumCulled = false
    this.group.add(mesh)
    this.meshes.push(mesh)
  }

  build() {
    this.clear()
    const occ = new Map()
    for (const it of this.solid) occ.set(it.x + ',' + it.y + ',' + it.z, it)
    for (const it of this.glow) occ.set(it.x + ',' + it.y + ',' + it.z, it)
    const wins = this.solid.filter(i => i.win)
    const solid = this.solid.filter(i => !i.win)
    this._mesh(solid, this.sys.solidMat, true, false, occ)
    this._mesh(wins, this.sys.winMat, true, false, occ)
    this._mesh(this.glow, this.sys.glowMat, false, true, occ)
  }
}
