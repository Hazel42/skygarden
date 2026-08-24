import * as THREE from 'three'
import { glowTex } from './textures.js'

const KEYS = [
  { t: 0.00, sky: '#FFC9B8', fog: '#FFDCC8', sun: '#FFB27A', si: 0.95, hi: 0.5 },
  { t: 0.07, sky: '#BFE3F2', fog: '#D8EFF6', sun: '#FFE8C4', si: 1.15, hi: 0.62 },
  { t: 0.30, sky: '#A9DCF4', fog: '#CFEDF8', sun: '#FFF4DC', si: 1.3, hi: 0.72 },
  { t: 0.44, sky: '#FFCB9E', fog: '#FFE0BC', sun: '#FFAB60', si: 1.05, hi: 0.55 },
  { t: 0.52, sky: '#E89BB4', fog: '#F4BFCA', sun: '#FF8E6A', si: 0.75, hi: 0.42 },
  { t: 0.60, sky: '#4A4C86', fog: '#63648F', sun: '#B98CD4', si: 0.34, hi: 0.28 },
  { t: 0.66, sky: '#1B2145', fog: '#2A3060', sun: '#AFC4FF', si: 0.34, hi: 0.2 },
  { t: 0.82, sky: '#121838', fog: '#20264E', sun: '#AFC4FF', si: 0.32, hi: 0.18 },
  { t: 0.93, sky: '#33305E', fog: '#4A4472', sun: '#C9A7FF', si: 0.38, hi: 0.26 },
  { t: 1.00, sky: '#FFC9B8', fog: '#FFDCC8', sun: '#FFB27A', si: 0.95, hi: 0.5 }
]

const CYCLE = 240
const clamp01 = v => Math.min(1, Math.max(0, v))
const smoothstep = (a, b, x) => {
  const k = clamp01((x - a) / (b - a))
  return k * k * (3 - 2 * k)
}

export class DayNight {
  constructor(scene, opts) {
    this.scene = scene
    this.hemi = opts.hemi
    this.sunLight = opts.sunLight
    this.winMat = opts.winMat
    this.lanternLights = opts.lanternLights || []
    this.renderer = opts.renderer

    this.tod = 0.09
    this.speed = 1
    this.env = { nf: 0, wind: 0 }
    this._c1 = new THREE.Color()
    this._c2 = new THREE.Color()
    this._cSky = new THREE.Color()
    this._cFog = new THREE.Color()
    this._dir = new THREE.Vector3()

    scene.fog = new THREE.Fog(0xd8eff6, 55, 170)

    const starPos = []
    const starCol = []
    const cols = [[1, 1, 1], [0.8, 0.87, 1], [1, 0.93, 0.8], [0.85, 0.8, 1]]
    for (let i = 0; i < 750; i++) {
      const elev = Math.pow(Math.random(), 1.4) * Math.PI * 0.52
      const az = Math.random() * Math.PI * 2
      const r = 135
      starPos.push(Math.cos(az) * Math.cos(elev) * r, Math.sin(elev) * r, Math.sin(az) * Math.cos(elev) * r)
      const c = cols[(Math.random() * cols.length) | 0]
      starCol.push(c[0], c[1], c[2])
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    sg.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      size: 1.7, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: 0, depthWrite: false, fog: false
    }))
    this.stars.frustumCulled = false
    scene.add(this.stars)

    const mkBody = (hex, s) => {
      const m = new THREE.SpriteMaterial({
        map: glowTex, color: hex, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false
      })
      const sp = new THREE.Sprite(m)
      sp.scale.setScalar(s)
      sp.visible = false
      scene.add(sp)
      return sp
    }
    this.sunSprite = mkBody('#FFD9A0', 30)
    this.moonSprite = mkBody('#D8E4FF', 17)

    this.hemi.groundColor.set('#6B5A4C')
  }

  sample(tod) {
    let a = KEYS[0], b = KEYS[KEYS.length - 1]
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (tod >= KEYS[i].t && tod <= KEYS[i + 1].t) {
        a = KEYS[i]; b = KEYS[i + 1]
        break
      }
    }
    const k = (tod - a.t) / Math.max(b.t - a.t, 1e-5)
    this._cSky.set(a.sky).lerp(this._c1.set(b.sky), k)
    this._cFog.set(a.fog).lerp(this._c1.set(b.fog), k)
    this._c1.set(a.sun).lerp(this._c2.set(b.sun), k)
    const si = a.si + (b.si - a.si) * k
    const hi = a.hi + (b.hi - a.hi) * k
    return { sky: this._cSky, fog: this._cFog, sun: this._c1.clone(), si, hi }
  }

  update(dt, tGlob) {
    this.tod = (this.tod + (dt / CYCLE) * this.speed) % 1
    const tod = this.tod
    const K = this.sample(tod)

    const el = Math.sin(tod * Math.PI * 2)
    const az = tod * Math.PI * 2
    const nf = clamp01(-el * 2.2 + 0.12)
    this.env.nf = nf
    this.env.wind = Math.sin(tGlob * 0.13) * 0.6 + Math.sin(tGlob * 0.071 + 2) * 0.4

    this.scene.background = this.scene.background || new THREE.Color()
    this.scene.background.copy(K.sky)
    this.scene.fog.color.copy(K.fog)

    this.hemi.color.copy(K.sky).lerp(this._c2.set('#FFFFFF'), 0.35)
    this.hemi.intensity = K.hi

    const ce = Math.cos(el * 1.35)
    const sunDir = this._dir.set(
      Math.cos(az) * Math.max(ce, 0.03),
      Math.max(Math.sin(el * 1.35), 0.04),
      Math.sin(az) * Math.max(ce, 0.03)
    )
    const w = smoothstep(-0.04, 0.22, el)
    const mx = -Math.cos(az), my = Math.max(-el * 1.2, 0.12)
    this.sunLight.position.set(
      sunDir.x * w + mx * (1 - w),
      sunDir.y * w + my * (1 - w),
      sunDir.z * w + (-Math.sin(az)) * (1 - w)
    ).normalize().multiplyScalar(46)
    this.sunLight.color.copy(K.sun)
    this.sunLight.intensity = K.si

    if (this.renderer) this.renderer.toneMappingExposure = 1.06 - nf * 0.17

    this.stars.material.opacity = nf * (0.75 + Math.sin(tGlob * 0.7) * 0.12)
    this.stars.rotation.y += dt * 0.004

    this.sunSprite.visible = el > -0.14
    if (this.sunSprite.visible) {
      this.sunSprite.position.set(
        Math.cos(az) * 120, Math.sin(el * 1.35) * 120, Math.sin(az) * 120
      )
      this.sunSprite.material.opacity = smoothstep(-0.14, 0.02, el) * 0.9
    }
    const mel = -el
    this.moonSprite.visible = mel > 0.06
    if (this.moonSprite.visible) {
      this.moonSprite.position.set(
        -Math.cos(az) * 120, mel * 115, -Math.sin(az) * 120
      )
      this.moonSprite.material.opacity = smoothstep(0.06, 0.3, mel)
    }

    if (this.winMat) this.winMat.opacity = 0.22 + nf * 0.78
    this.lanternLights.forEach((L, i) => {
      const flick = i === 1 ? 0.9 + 0.1 * Math.sin(tGlob * 6.3 + i * 2) : 1
      L.intensity = L.userData.base * nf * flick
    })

    return this.env
  }
}
