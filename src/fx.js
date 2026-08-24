import * as THREE from 'three'
import { sparkTex, petalTex, dropTex } from './textures.js'

const PETAL_COLORS = ['#FFC9DC', '#FFB3CE', '#FFDDEC', '#FF9EC0']

class PointPool {
  constructor(scene, tex, count, size, additive = true, opacity = 1) {
    this.count = count
    this.cursor = 0
    this.pos = new Float32Array(count * 3)
    this.col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -999
    this.d = Array.from({ length: count }, () => ({
      life: 0, max: 1, vx: 0, vy: 0, vz: 0, ay: 0, drag: 1,
      cr: 1, cg: 1, cb: 1, seed: Math.random() * 10, mode: 0, br: 1
    }))
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    const mat = new THREE.PointsMaterial({
      map: tex, size, transparent: true, depthWrite: false,
      vertexColors: true, sizeAttenuation: true, opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    scene.add(this.points)
    this.geo = geo
  }

  spawn(x, y, z, o = {}) {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % this.count
    const p = this.d[i]
    p.life = p.max = o.max ?? 1
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0
    p.ay = o.ay ?? 0
    p.drag = o.drag ?? 1
    p.mode = o.mode ?? 0
    p.br = o.br ?? 1
    const c = o.c
    if (c) { p.cr = c[0]; p.cg = c[1]; p.cb = c[2] }
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z
    return i
  }

  setColor(i, hex, mult = 1) {
    const c = new THREE.Color(hex).multiplyScalar(mult)
    const p = this.d[i]
    p.cr = c.r; p.cg = c.g; p.cb = c.b
  }

  update(dt, t, env) {
    const { pos, col, d } = this
    for (let i = 0; i < this.count; i++) {
      const p = d[i]
      if (p.life <= 0) continue
      const ix = i * 3
      p.life -= dt

      if (p.mode === 2 || p.mode === 3) {
        p.vx += (Math.sin(t * 2 + p.seed) * 0.4 + env.wind * 0.8) * dt
        p.vy += p.ay * dt
        p.vx *= p.drag; p.vz *= p.drag
      } else {
        p.vy += p.ay * dt
        const dr = Math.pow(p.drag, dt * 60)
        p.vx *= dr; p.vy *= dr; p.vz *= dr
        if (p.mode === 1) {
          p.vx += (Math.sin(t * 2.2 + p.seed) * 0.9 + env.wind * 2.2) * dt
          p.vz += Math.cos(t * 1.7 + p.seed) * 0.5 * dt
        } else {
          p.vx += Math.sin(t * 3 + p.seed) * 0.35 * dt
          p.vz += Math.cos(t * 2.6 + p.seed) * 0.35 * dt
        }
      }

      pos[ix] += p.vx * dt
      pos[ix + 1] += p.vy * dt
      pos[ix + 2] += p.vz * dt

      let a = 1
      if (p.mode === 1) {
        if (pos[ix + 1] < -3 || Math.abs(pos[ix]) > 48 || Math.abs(pos[ix + 2]) > 48) p.life = 0
        else a = 0.9
      } else if (p.mode === 4) {
        a = 1
        if (pos[ix + 1] < 0) { pos[ix + 1] = 26 + Math.random() * 12; pos[ix] = (Math.random() * 2 - 1) * 34; pos[ix + 2] = (Math.random() * 2 - 1) * 34 }
      } else {
        const k = Math.max(p.life / p.max, 0)
        a = k * k
      }

      if (p.life <= 0) {
        pos[ix + 1] = -999
        col[ix] = col[ix + 1] = col[ix + 2] = 0
        continue
      }

      let glowMul = 1
      if (p.mode === 5 && env) glowMul = env.nf * (0.55 + 0.45 * Math.sin(t * 2.4 + p.seed * 7))

      col[ix] = p.cr * a * p.br * glowMul
      col[ix + 1] = p.cg * a * p.br * glowMul
      col[ix + 2] = p.cb * a * p.br * glowMul
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
  }
}

export class FX {
  constructor(scene, anchors) {
    this.scene = scene
    this.anchors = anchors
    this.t = 0
    this.sakuraLevel = 0
    this.rainActive = false

    this.petals = new PointPool(scene, petalTex, 900, 0.85)
    this.sparks = new PointPool(scene, sparkTex, 700, 0.55)
    this.jet = new PointPool(scene, sparkTex, 150, 0.7)
    this.mist = new PointPool(scene, sparkTex, 90, 1.6)
    this.rain = new PointPool(scene, dropTex, 420, 0.5, false, 0.55)
    this.flies = new PointPool(scene, sparkTex, 36, 0.42)
    this.smoke = new PointPool(scene, sparkTex, 110, 1.0, false, 0.38)
    this.smokeOn = false
    this.smokeAnchor = null
    this.smokeAcc = 0

    this.ripples = []
    const rGeo = new THREE.RingGeometry(0.82, 1, 44)
    for (let i = 0; i < 12; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: '#FFD9EC', transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        depthWrite: false, toneMapped: false
      })
      const mesh = new THREE.Mesh(rGeo, m)
      mesh.rotation.x = -Math.PI / 2
      mesh.visible = false
      scene.add(mesh)
      this.ripples.push({ mesh, m, life: 0 })
    }
    this.ripCursor = 0

    this.jetAcc = 0
    this.mistAcc = 0
    this._c = new THREE.Color()
  }

  ripple(point, color = '#FFD9EC') {
    const r = this.ripples[this.ripCursor]
    this.ripCursor = (this.ripCursor + 1) % this.ripples.length
    r.mesh.position.copy(point)
    r.mesh.position.y = point.y + 0.06
    r.mesh.scale.setScalar(0.01)
    r.m.color.set(color)
    r.m.opacity = 0.95
    r.mesh.visible = true
    r.life = 0.8
  }

  _petalColors() {
    return PETAL_COLORS
  }

  burst(pos, kind = 'tap') {
    const pc = this._petalColors()
    const nP = kind === 'celebrate' ? 30 : 13
    const nS = kind === 'celebrate' ? 22 : kind === 'poof' ? 14 : 9
    for (let i = 0; i < nP; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 1 + Math.random() * 1.6
      this.petals.spawn(pos.x, pos.y + 0.3, pos.z, {
        max: 0.9 + Math.random() * 0.6,
        vx: Math.cos(a) * sp, vy: 1.6 + Math.random() * 2.4, vz: Math.sin(a) * sp,
        ay: -4.2, drag: 0.965, mode: 0,
        c: this._c.set(pc[(Math.random() * pc.length) | 0]).multiplyScalar(1.15).toArray()
      })
    }
    for (let i = 0; i < nS; i++) {
      const a = Math.random() * Math.PI * 2
      const up = Math.random()
      const sp = 1.5 + Math.random() * 3
      const col = kind === 'poof' ? '#FFF7EA' : (Math.random() < 0.6 ? '#FFE2A2' : '#FFF6D8')
      this.sparks.spawn(pos.x, pos.y + 0.4, pos.z, {
        max: 0.45 + Math.random() * 0.65,
        vx: Math.cos(a) * sp, vy: up * 3 + 1, vz: Math.sin(a) * sp,
        ay: -7, drag: 0.94, mode: 0, c: this._c.set(col).multiplyScalar(1.3).toArray()
      })
    }
    if (kind !== 'tap') this.ripple(pos, kind === 'poof' ? '#FFFFFF' : '#FFE2A2')
  }

  spawnSpark(p, palette) {
    const cols = palette || ['#FFB05C', '#FFD27A', '#FF7E5A']
    this.sparks.spawn(
      p.x + (Math.random() - 0.5) * 1.6,
      p.y + (Math.random() - 0.5) * 1.2,
      p.z + (Math.random() - 0.5) * 1.6,
      {
        max: 0.7 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 0.8, vy: -0.3 + Math.random(), vz: (Math.random() - 0.5) * 0.8,
        ay: -2.5, drag: 0.97, mode: 0,
        c: this._c.set(cols[(Math.random() * cols.length) | 0]).multiplyScalar(1.25).toArray()
      }
    )
  }

  setIncense(anchor) {
    this.smokeOn = !!anchor
    this.smokeAnchor = anchor
  }

  update(dt, t, env) {
    this.t = t
    this.petals.update(dt, t, env)
    this.sparks.update(dt, t, env)
    this.flies.update(dt, t, env)

    if (this.smokeOn && this.smokeAnchor) {
      this.smokeAcc += dt * 20
      while (this.smokeAcc >= 1) {
        this.smokeAcc -= 1
        const idx = this.smoke.spawn(
          this.smokeAnchor.x + (Math.random() - 0.5) * 0.4,
          this.smokeAnchor.y,
          this.smokeAnchor.z + (Math.random() - 0.5) * 0.4,
          {
            max: 2.2 + Math.random(), vx: (Math.random() - 0.5) * 0.15,
            vy: 0.85 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.15,
            ay: 0.12, drag: 0.999, mode: 6, br: 0.85,
            c: [0.72, 0.77, 0.8]
          }
        )
        this.smoke.setColor(idx, '#B8C4CC', 0.9)
      }
    }
    this.smoke.update(dt, t, env)

    const wantAmbient = this.sakuraLevel > 0 ? 230 : 80
    let live = 0
    for (let i = 0; i < this.petals.count; i++) {
      if (this.petals.d[i].life > 0 && this.petals.d[i].mode === 1) live++
    }
    const trees = this.anchors.trees
    let guard = 24
    while (live < wantAmbient && guard-- > 0) {
      live++
      if (this.sakuraLevel > 0 || Math.random() < 0.75) {
        const tr = trees[(Math.random() * trees.length) | 0]
        const x = tr.x + (Math.random() - 0.5) * tr.rad * 2.4
        const z = tr.z + (Math.random() - 0.5) * tr.rad * 2.4
        const y = tr.y + Math.random() * 1.5
        const idx = this.petals.spawn(x, y, z, {
          max: 9999, mode: 1, drag: 1, ay: -1.15,
          vx: 0, vy: -1.1, vz: 0
        })
        this.petals.setColor(idx, this._petalColors()[(Math.random() * 4) | 0], 1)
      } else {
        const a = Math.random() * Math.PI * 2
        const rr = Math.sqrt(Math.random()) * 34
        const idx = this.petals.spawn(Math.cos(a) * rr, 16 + Math.random() * 8, Math.sin(a) * rr, {
          max: 9999, mode: 1, drag: 1, ay: -1.05
        })
        this.petals.setColor(idx, this._petalColors()[(Math.random() * 4) | 0], 1)
      }
    }

    const lip = this.anchors.waterfall
    this.jetAcc += dt * 74
    while (this.jetAcc >= 1) {
      this.jetAcc -= 1
      const idx = this.jet.spawn(
        lip.x + (Math.random() - 0.5) * 1.4,
        lip.y + Math.random() * 0.3,
        lip.z + (Math.random() - 0.5) * 1.4,
        {
          max: 1.1, vx: -1.4 + Math.random() * 0.5, vy: -0.5, vz: (Math.random() - 0.5) * 0.5,
          ay: -17, drag: 1, mode: 2,
          c: [0.75, 0.92, 1]
        }
      )
      this.jet.setColor(idx, '#BFEFFF', 1.05)
    }
    this.jet.update(dt, t, env)

    this.mistAcc += dt * 26
    while (this.mistAcc >= 1) {
      this.mistAcc -= 1
      const idx = this.mist.spawn(
        lip.x - 2.6 + (Math.random() - 0.5) * 3,
        0.5 + Math.random() * 1.5,
        lip.z + (Math.random() - 0.5) * 3,
        {
          max: 1.5 + Math.random(), vx: (Math.random() - 0.5) * 0.7, vy: 0.5 + Math.random() * 0.7, vz: (Math.random() - 0.5) * 0.7,
          ay: 0.25, drag: 0.985, mode: 3, br: 0.5,
          c: [0.8, 0.93, 1]
        }
      )
      this.mist.setColor(idx, '#CFEFFF', 0.6)
    }
    this.mist.update(dt, t, env)

    if (this.rainActive) {
      for (let i = 0; i < this.rain.count; i++) {
        if (this.rain.d[i].life <= 0) {
          const idx = this.rain.spawn(
            (Math.random() * 2 - 1) * 36, 27 + Math.random() * 12, (Math.random() * 2 - 1) * 36,
            { max: 9999, mode: 4, vy: -23, ay: 0 }
          )
          this.rain.setColor(idx, '#CFE8FF', 0.9)
        }
      }
    }
    this.rain.points.visible = this.rainActive
    this.rain.update(dt, t, env)

    for (let i = 0; i < this.flies.count; i++) {
      const p = this.flies.d[i]
      if (p.life <= 0) {
        const idx = this.flies.spawn(
          (Math.random() - 0.5) * 34, 11 + Math.random() * 6, (Math.random() - 0.5) * 34,
          { max: 9999, mode: 5, vx: (Math.random() - 0.5), vy: 0, vz: (Math.random() - 0.5), drag: 1 }
        )
        this.flies.setColor(idx, '#E8FFB0', 1)
      } else {
        p.vx += (Math.random() - 0.5) * 2.4 * dt
        p.vy += (Math.random() - 0.5) * 1.6 * dt
        p.vz += (Math.random() - 0.5) * 2.4 * dt
        const s = Math.hypot(p.vx, p.vy, p.vz)
        if (s > 0.8) { p.vx *= 0.8 / s; p.vy *= 0.8 / s; p.vz *= 0.8 / s }
        const ix = i * 3
        const P = this.flies.pos
        if (Math.abs(P[ix]) > 19 || P[ix + 1] < 10.5 || P[ix + 1] > 19) {
          p.life = 0
          P[ix + 1] = -999
        }
      }
    }

    for (const r of this.ripples) {
      if (r.life <= 0) continue
      r.life -= dt
      const k = Math.max(r.life / 0.8, 0)
      r.mesh.scale.addScalar(dt * 9)
      r.m.opacity = k * 0.95
      if (r.life <= 0) r.mesh.visible = false
    }
  }
}
