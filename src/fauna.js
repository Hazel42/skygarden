import * as THREE from 'three'
import gsap from 'gsap'
import { glowTex } from './textures.js'
import { C } from './palette.js'

const RABBIT_FALLBACK_Y = 10.48

const lam = (hex) => new THREE.MeshLambertMaterial({ color: hex })
const glowMatOf = (hex) => new THREE.MeshBasicMaterial({
  color: new THREE.Color(hex).multiplyScalar(1.25), toneMapped: false
})

function koiMats() {
  return {
    white: lam('#FFF6EA'), orange: lam('#FF9A5A'), red: lam('#F4746A'),
    gold: lam('#FFC46B'), dark: lam('#5A4A52')
  }
}

function makeKoi(mats, morph) {
  const g = new THREE.Group()
  const box = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    g.add(mesh)
    return mesh
  }
  const c1 = morph === 0 ? mats.white : morph === 1 ? mats.gold : mats.white
  const c2 = morph === 0 ? mats.orange : morph === 1 ? mats.white : mats.red
  box(0.55, 0.42, 0.42, c1, 0.5, 0, 0)
  const patch = box(0.3, 0.44, 0.44, c2, 0.32, 0, 0)
  patch.scale.set(1, 1.02, 1.02)
  box(0.5, 0.38, 0.36, c1, 0, 0, 0)
  const tailPivot = new THREE.Group()
  tailPivot.position.set(-0.28, 0, 0)
  const tail = new THREE.Group()
  const tm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.2), c2)
  tm.position.x = -0.17
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.44), c2)
  fin.position.set(-0.4, 0, 0)
  tail.add(tm, fin)
  tailPivot.add(tail)
  g.add(tailPivot)
  const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08), c2)
  dorsal.position.set(0, 0.24, 0)
  g.add(dorsal)
  g.userData.tail = tail
  return g
}

function makeButterfly() {
  const g = new THREE.Group()
  const palette = ['#FF9EC8', '#A8E8DC', '#CBA8FF', '#FFD48A']
  const col = palette[Math.floor(Math.random() * palette.length)]
  const magical = Math.random() < 0.5
  const mat = magical
    ? new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.2), toneMapped: false, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.09),
    new THREE.MeshLambertMaterial({ color: '#5A4658' }))
  g.add(body)
  const wg = new THREE.PlaneGeometry(0.55, 0.4)
  wg.rotateX(-Math.PI / 2)
  wg.translate(0, 0, 0.29)
  const wl = new THREE.Mesh(wg, mat)
  const wr = new THREE.Mesh(wg, mat)
  wr.scale.z = -1
  g.add(wl, wr)
  g.userData.wings = [wl, wr]
  return g
}

function makeFox() {
  const g = new THREE.Group()
  const box = (w, h, d, hex, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(hex))
    m.position.set(x, y, z)
    m.rotation.y = ry
    g.add(m)
    return m
  }
  box(1.5, 0.8, 1.05, C.fox, 0, 0.42, 0)
  box(0.75, 0.5, 0.92, C.foxCream, 0.42, 0.3, 0)
  box(0.74, 0.6, 0.66, C.fox, 0.82, 0.82, 0)
  box(0.3, 0.2, 0.24, C.foxCream, 1.2, 0.72, 0)
  box(0.16, 0.26, 0.13, C.fox, 0.72, 1.22, 0.2)
  box(0.16, 0.26, 0.13, C.fox, 0.72, 1.22, -0.2)
  box(0.03, 0.07, 0.16, '#4A3428', 1.19, 0.88, 0.17)
  box(0.03, 0.07, 0.16, '#4A3428', 1.19, 0.88, -0.17)
  const tail = box(1.0, 0.3, 0.32, C.fox, -0.35, 0.3, 0.62, 0.5)
  box(0.34, 0.32, 0.34, C.foxCream, -0.78, 0.34, 0.86, 0.5)
  g.traverse(o => { if (o.isMesh) o.userData.special = 'fox' })
  g.userData.body = tail.parent.children[0]
  g.userData.breathG = g
  return g
}

function makeWisp() {
  const mat = new THREE.SpriteMaterial({
    map: glowTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false
  })
  const cols = ['#BFFFE0', '#FFD4EC', '#CFE0FF', '#FFF0B8']
  mat.color.set(cols[Math.floor(Math.random() * cols.length)])
  const s = new THREE.Sprite(mat)
  s.scale.setScalar(1.15)
  return s
}

function makePhoenix() {
  const g = new THREE.Group()
  const gold = lam('#FFC46B'), flame = lam('#FF8A50'), red = lam('#F4574D'), cream = lam('#FFEBC4')
  const box = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    g.add(mesh)
    return mesh
  }
  box(1.5, 0.95, 0.95, gold, 0, 0, 0)
  box(0.6, 0.55, 0.6, flame, 0.95, 0.45, 0)
  box(0.24, 0.18, 0.3, cream, 1.32, 0.4, 0)
  box(0.16, 0.34, 0.1, red, 0.95, 0.86, 0)
  const crest = box(0.1, 0.3, 0.08, red, 0.78, 0.95, 0)
  crest.rotation.z = 0.5
  const tailPivots = []
  for (let i = -1; i <= 1; i++) {
    const piv = new THREE.Group()
    piv.position.set(-0.75, 0.1, i * 0.22)
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.3), i === 0 ? red : flame)
    t.position.x = -0.85
    piv.add(t)
    piv.rotation.y = i * 0.3
    g.add(piv)
    tailPivots.push(piv)
  }
  const wg = new THREE.PlaneGeometry(2.7, 1.15)
  wg.rotateX(-Math.PI / 2)
  wg.translate(0, 0, 1.35)
  const wm = new THREE.MeshLambertMaterial({ color: '#FFB05C', side: THREE.DoubleSide })
  const wl = new THREE.Mesh(wg, wm)
  const wr = new THREE.Mesh(wg, wm)
  wr.scale.z = -1
  wl.position.set(-0.2, 0.4, 0)
  wr.position.set(-0.2, 0.4, 0)
  g.add(wl, wr)
  g.scale.setScalar(1.45)
  g.userData.wings = [wl, wr]
  g.userData.tails = tailPivots
  return g
}

function makeDragon() {
  const AZURE = '#8FD8E8', AZURE_D = '#5FB4CC', GOLD = '#FFD27A', CREAM = '#FFF3DC'
  const lamC = h => new THREE.MeshLambertMaterial({ color: h })
  const mAzure = lamC(AZURE), mAzureD = lamC(AZURE_D), mGold = lamC(GOLD), mCream = lamC(CREAM)
  const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.3), toneMapped: false })

  const head = new THREE.Group()
  const box = (parent, w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
  box(head, 1.15, 0.95, 0.95, mAzure, 0, 0, 0)
  box(head, 0.9, 0.55, 0.7, mAzureD, 1.0, -0.12, 0)
  box(head, 0.3, 0.28, 0.5, mCream, 1.55, -0.18, 0)
  box(head, 0.14, 0.14, 0.14, glowM, 0.62, 0.22, 0.42)
  box(head, 0.14, 0.14, 0.14, glowM, 0.62, 0.22, -0.42)
  for (const s of [1, -1]) {
    const horn = new THREE.Group()
    horn.position.set(-0.15, 0.45, s * 0.32)
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), mCream)
    h1.position.y = 0.35
    h1.rotation.z = -0.25
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.13), mCream)
    h2.position.set(0.24, 0.85, 0)
    h2.rotation.z = 0.6
    horn.add(h1, h2)
    head.add(horn)
    const wisk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.05), glowM)
    wisk.position.set(1.9, -0.3, s * 0.5)
    wisk.rotation.y = s * 0.45
    wisk.rotation.z = -0.15
    head.add(wisk)
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), glowM)
    mane.position.set(-0.65, 0.3 + (s > 0 ? 0 : 0.25), s * 0.34)
    head.add(mane)
  }

  const segs = [head]
  const N = 26
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group()
    const k = i / N
    const s = 0.95 - k * 0.6
    box(g, s, s * 0.92, s * 0.88, i % 2 ? mAzureD : mAzure, 0, 0, 0)
    if (i % 2 === 0 && i < N - 2) {
      const plate = box(g, s * 0.35, s * 0.5, s * 1.1, mGold, 0, s * 0.62, 0)
      plate.rotation.x = 0.12
    }
    if (i > N - 4) {
      const fan = box(g, s * 1.6, s * 0.12, s * 1.4, mGold, -s * 0.6, 0, 0)
      fan.rotation.z = 0.2 * (i - (N - 4))
    }
    segs.push(g)
  }
  return { head, segs }
}

function makeCrane() {
  const g = new THREE.Group()
  const white = new THREE.MeshLambertMaterial({ color: '#FDFBF4' })
  const black = new THREE.MeshLambertMaterial({ color: '#3A3A44' })
  const red = new THREE.MeshLambertMaterial({ color: '#E84A4A' })
  const gold = new THREE.MeshLambertMaterial({ color: '#D9A441' })
  const box = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    g.add(mesh)
    return mesh
  }
  box(1.0, 0.55, 0.55, white, 0, 0, 0)
  box(0.22, 0.22, 0.22, white, 0.75, 0.42, 0)
  box(0.34, 0.09, 0.09, gold, 1.0, 0.38, 0)
  box(0.1, 0.08, 0.1, red, 0.75, 0.58, 0)
  const neck1 = box(0.16, 0.16, 0.16, white, 0.45, 0.26, 0)
  neck1.rotation.z = 0.6
  box(0.55, 0.28, 0.3, black, -0.68, 0.08, 0)
  box(0.06, 0.06, 0.7, black, -0.5, -0.32, 0.12)
  box(0.06, 0.06, 0.7, black, -0.5, -0.32, -0.12)
  const wg = new THREE.PlaneGeometry(2.3, 0.85)
  wg.rotateX(-Math.PI / 2)
  wg.translate(0, 0, 1.15)
  const wl = new THREE.Mesh(wg, white)
  const wr = new THREE.Mesh(wg, white)
  wr.scale.z = -1
  const tipL = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.85).rotateX(-Math.PI / 2), black)
  tipL.position.set(0, 0.01, 2.2)
  const tipR = tipL.clone()
  tipR.scale.z = -1
  wl.position.set(-0.1, 0.3, 0)
  wr.position.set(-0.1, 0.3, 0)
  tipL.position.x = tipR.position.x = -0.1
  wl.add(tipL)
  wr.add(tipR)
  g.add(wl, wr)
  g.userData.wings = [wl, wr]
  return g
}

function makeRabbit() {
  const g = new THREE.Group()
  const white = new THREE.MeshLambertMaterial({ color: '#FBF8F2' })
  const pink = new THREE.MeshLambertMaterial({ color: '#F5B8C8' })
  const dark = new THREE.MeshLambertMaterial({ color: '#4A4048' })
  const box = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    g.add(mesh)
    return mesh
  }
  box(0.72, 0.78, 0.62, white, 0, 0.39, 0)
  box(0.55, 0.5, 0.52, white, 0, 0.98, 0.06)
  box(0.16, 0.66, 0.12, white, 0.14, 1.52, 0.02)
  box(0.16, 0.66, 0.12, white, -0.14, 1.52, 0.02)
  box(0.08, 0.4, 0.04, pink, 0.14, 1.5, 0.09)
  box(0.08, 0.4, 0.04, pink, -0.14, 1.5, 0.09)
  box(0.07, 0.07, 0.04, dark, 0.13, 1.02, 0.33)
  box(0.07, 0.07, 0.04, dark, -0.13, 1.02, 0.33)
  box(0.26, 0.26, 0.2, white, 0, 0.22, -0.36)
  box(0.3, 0.14, 0.3, white, 0.02, 0.07, 0.3)
  const elixir = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.22),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#BFFFE0').multiplyScalar(1.25), toneMapped: false })
  )
  elixir.position.set(0, 0.18, 0.52)
  g.add(elixir)

  const haloMat = new THREE.SpriteMaterial({
    map: glowTex, color: '#DFF6FF', transparent: true,
    opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  })
  const halo = new THREE.Sprite(haloMat)
  halo.scale.setScalar(2.6)
  halo.position.set(0, 1.1, 0)
  g.add(halo)
  g.userData.elixir = elixir
  return g
}

function makeGoldenButterfly() {
  const g = new THREE.Group()
  const wingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#FFE29A').multiplyScalar(1.35),
    toneMapped: false, side: THREE.DoubleSide
  })
  const bodyMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#FFD27A').multiplyScalar(1.25), toneMapped: false
  })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.14), bodyMat)
  g.add(body)
  const wg = new THREE.PlaneGeometry(1.05, 0.75)
  wg.rotateX(-Math.PI / 2)
  wg.translate(0, 0, 0.55)
  const wl = new THREE.Mesh(wg, wingMat)
  const wr = new THREE.Mesh(wg, wingMat)
  wr.scale.z = -1
  g.add(wl, wr)
  g.userData.wings = [wl, wr]
  g.traverse(o => { if (o.isMesh) o.userData.special = 'golden' })
  g.visible = false
  g.scale.setScalar(1.5)
  return g
}

export class Fauna {
  constructor(scene, anchors) {
    this.scene = scene
    this.anchors = anchors
    this.mats = koiMats()
    this.t = 0

    this.koi = []
    for (let i = 0; i < 8; i++) {
      const morph = i % 3
      const g = makeKoi(this.mats, morph)
      g.visible = false
      scene.add(g)
      this.koi.push({ g, ang: Math.random() * Math.PI * 2, r: 1.3 + (i % 4) * 0.55, spd: (0.35 + Math.random() * 0.3), ph: Math.random() * 6, sc: 0.85 + Math.random() * 0.35 })
    }

    this.flies = []
    for (let i = 0; i < 12; i++) {
      const g = makeButterfly()
      g.visible = false
      scene.add(g)
      const tree = anchors.trees[i % anchors.trees.length]
      this.flies.push({ g, tree, ph: Math.random() * 10, r: 1.4 + Math.random() * 1.6 })
    }

    this.fox = makeFox()
    this.fox.visible = false
    scene.add(this.fox)

    this.wisps = []
    for (let i = 0; i < 10; i++) {
      const s = makeWisp()
      s.visible = false
      scene.add(s)
      this.wisps.push({ s, ph: Math.random() * 12, r: 7 + Math.random() * 9, y: 12 + Math.random() * 7, sp: 0.1 + Math.random() * 0.12 })
    }

    this.phoenix = makePhoenix()
    this.phoenix.visible = false
    scene.add(this.phoenix)
    this.emberT = 0

    const dragon = makeDragon()
    this.dragonHead = dragon.head
    this.dragonSegs = dragon.segs
    this.dragonHead.visible = false
    this.dragonSegs.forEach(s => (s.visible = false))
    scene.add(this.dragonHead)
    this.dragonSegs.forEach(s => scene.add(s))
    this.dragonU = Math.random() * 100
    this.dragonCallT = 30 + Math.random() * 40

    this.cranes = []
    for (let i = 0; i < 2; i++) {
      const c = makeCrane()
      c.visible = false
      scene.add(c)
      this.cranes.push({ g: c, ph: i * Math.PI })
    }

    this.rabbit = makeRabbit()
    this.rabbit.visible = false
    scene.add(this.rabbit)

    this.goldenG = makeGoldenButterfly()
    scene.add(this.goldenG)
    this.goldenT = 40 + Math.random() * 60
    this.goldenAnim = null
    this.onGoldenStart = null

    this.onEmber = null
    this.onDragonCall = null
    this.koiGold = false
  }

  startGolden() {
    const a = Math.random() * Math.PI * 2
    const a2 = a + 2.4 + Math.random() * 0.8
    this.goldenAnim = {
      a: new THREE.Vector3(Math.cos(a) * 31, 13 + Math.random() * 2, Math.sin(a) * 31),
      b: new THREE.Vector3(Math.cos(a2) * 31, 15 + Math.random() * 3, Math.sin(a2) * 31),
      t: 0,
      dur: 13 + Math.random() * 4
    }
    this.goldenG.position.copy(this.goldenAnim.a)
    this.goldenG.visible = true
    if (this.onGoldenStart) this.onGoldenStart()
  }

  hideGolden() {
    this.goldenG.visible = false
    this.goldenAnim = null
    this.goldenT = 70 + Math.random() * 80
  }

  setKoi(n) { for (let i = 0; i < this.koi.length; i++) this.koi[i].g.visible = i < n }
  setButterflies(n) { for (let i = 0; i < this.flies.length; i++) this.flies[i].g.visible = i < n }
  setWisps(n) { for (let i = 0; i < this.wisps.length; i++) this.wisps[i].s.visible = i < n }
  setPhoenix(on) { this.phoenix.visible = !!on }
  setCranes(n) { this.cranes.forEach((c, i) => (c.g.visible = i < n)) }
  setDragon(on) {
    const v = !!on
    this.dragonHead.visible = v
    this.dragonSegs.forEach(s => (s.visible = v))
  }
  setRabbit(on, onJade) {
    this.rabbit.visible = !!on
    if (!on) return
    const p = onJade && this.anchors.rabbitJade ? this.anchors.rabbitJade : { x: -2, y: RABBIT_FALLBACK_Y, z: 7 }
    this.rabbit.position.set(p.x, p.y, p.z)
    this.rabbit.rotation.y = onJade ? -2.2 : 2.4
  }
  setKoiGold(on) {
    if (this.koiGold === on) return
    this.koiGold = on
    const goldA = new THREE.MeshLambertMaterial({ color: '#FFC46B' })
    const goldB = new THREE.MeshLambertMaterial({ color: '#FFE29A' })
    this.koi.forEach(k => {
      k.g.traverse(m => {
        if (m.isMesh) m.material = (m.position.x | 0) % 2 ? goldB : goldA
      })
      k.g.userData.tail.traverse(m => { if (m.isMesh) m.material = goldA })
    })
  }
  setFox(on, onIsle) {
    this.fox.visible = !!on
    if (!on) return
    const p = onIsle ? this.anchors.foxIsle : this.anchors.foxMain
    this.fox.position.set(p.x, p.y, p.z)
    this.fox.rotation.y = onIsle ? Math.PI : 0.6
  }

  foxHop() {
    if (!this.fox.visible || this.fox.userData.hopping) return
    this.fox.userData.hopping = true
    this.fox.userData.baseY = this.fox.position.y
    gsap.to(this.fox.position, {
      y: '+=0.38', duration: 0.16, yoyo: true, repeat: 1,
      ease: 'sine.out',
      onComplete: () => {
        this.fox.position.y = this.fox.userData.baseY
        this.fox.userData.hopping = false
      }
    })
  }

  update(dt) {
    this.t += dt
    const t = this.t
    const pond = this.anchors.pond

    for (const k of this.koi) {
      if (!k.g.visible) continue
      k.ang += k.spd * dt
      const px = pond.x + Math.cos(k.ang) * k.r
      const pz = pond.z + Math.sin(k.ang) * k.r
      k.g.position.set(px, 9.18 + Math.sin(t * 1.4 + k.ph) * 0.12, pz)
      const vx = -Math.sin(k.ang), vz = Math.cos(k.ang)
      k.g.rotation.y = Math.atan2(-vz, vx)
      k.g.rotation.z = Math.sin(t * 1.4 + k.ph) * 0.08
      k.g.scale.setScalar(k.sc)
      k.g.userData.tail.rotation.y = Math.sin(t * 7 + k.ph) * 0.4
    }

    for (const f of this.flies) {
      if (!f.g.visible) continue
      const a = t * 0.5 + f.ph
      const tr = f.tree
      const nx = tr.x + Math.sin(a * 1.3) * f.r * 1.4
      const ny = tr.y + Math.sin(a * 2.3) * 0.9 + 0.6
      const nz = tr.z + Math.cos(a * 1.7) * f.r * 1.4
      f.g.lookAt(nx, ny, nz)
      f.g.position.set(nx, ny, nz)
      const flap = Math.sin(t * 11 + f.ph) * 0.85
      f.g.userData.wings[0].rotation.x = -flap
      f.g.userData.wings[1].rotation.x = flap
    }

    if (this.fox.visible) {
      const b = this.fox.userData.breathG
      b.scale.y = 1 + Math.sin(t * 1.5) * 0.035
    }

    for (const w of this.wisps) {
      if (!w.s.visible) continue
      const a = t * w.sp + w.ph
      w.s.position.set(
        Math.cos(a) * w.r,
        w.y + Math.sin(t * 0.6 + w.ph) * 1.4,
        Math.sin(a * 0.8) * w.r
      )
      w.s.material.opacity = 0.45 + Math.sin(t * 2 + w.ph) * 0.25
    }

    if (this.phoenix.visible) {
      const top = this.anchors.pagodaTop
      const ang = t * 0.22
      const rad = 8.5 + Math.sin(t * 0.11) * 2.2
      const py = top.y - 1.5 + Math.sin(t * 0.19) * 2
      const px = top.x + Math.cos(ang) * rad
      const pz = top.z + Math.sin(ang) * rad
      this.phoenix.position.set(px, py, pz)
      const vx = -Math.sin(ang), vz = Math.cos(ang)
      this.phoenix.rotation.y = Math.atan2(-vz, vx)
      this.phoenix.rotation.z = 0.28
      const flap = Math.sin(t * 2.4) * 0.55
      this.phoenix.userData.wings[0].rotation.x = -flap
      this.phoenix.userData.wings[1].rotation.x = flap
      this.phoenix.userData.tails.forEach((tp, i) => {
        tp.rotation.x = Math.sin(t * 3 + i) * 0.18
      })
      this.emberT -= dt
      if (this.emberT <= 0 && this.onEmber) {
        this.emberT = 0.12
        this.onEmber(this.phoenix.position)
      }
    }

    if (this.dragonHead.visible) {
      this.dragonU += dt * 0.2
      const u = this.dragonU
      this._dp = this._dp || [new THREE.Vector3(), new THREE.Vector3()]
      const all = [this.dragonHead, ...this.dragonSegs]
      for (let j = 0; j < all.length; j++) {
        const seg = all[j]
        const uu = u - j * 0.155
        this._dragonPoint(uu, this._dp[0])
        seg.position.copy(this._dp[0])
        this._dragonPoint(uu + 0.05, this._dp[1])
        seg.lookAt(this._dp[1])
        seg.rotateZ(Math.sin(u * 0.9 + j * 0.28) * 0.3)
      }
      this.dragonCallT -= dt
      if (this.dragonCallT <= 0) {
        this.dragonCallT = 40 + Math.random() * 45
        if (this.onDragonCall) this.onDragonCall()
      }
      this._dEmber = (this._dEmber || 0) - dt
      if (this._dEmber <= 0 && this.onDragonSpark) {
        this._dEmber = 0.16
        const s = this.dragonSegs[(Math.random() * this.dragonSegs.length) | 0]
        this.onDragonSpark(s.position)
      }
    }

    for (const c of this.cranes) {
      if (!c.g.visible) continue
      const a = t * 0.3 + c.ph
      c.g.position.set(
        Math.sin(a) * 15 + 8,
        15.5 + Math.sin(a * 2 + 1) * 1.4,
        Math.sin(a * 2) * 8 - 2
      )
      const a2 = a + 0.06
      c.g.lookAt(
        Math.sin(a2) * 15 + 8,
        15.5 + Math.sin(a2 * 2 + 1) * 1.4,
        Math.sin(a2 * 2) * 8 - 2
      )
      const flap = Math.sin(t * 3 + c.ph) * 0.55
      c.g.userData.wings[0].rotation.x = -flap
      c.g.userData.wings[1].rotation.x = flap
    }

    if (this.rabbit.visible) {
      this.rabbit.scale.y = 1 + Math.sin(t * 1.7) * 0.04
      const e = this.rabbit.userData.elixir
      e.rotation.y += dt * 1.3
      e.position.y = 0.18 + Math.sin(t * 2.2) * 0.06
    }

    if (this.goldenG.visible && this.goldenAnim) {
      const G = this.goldenAnim
      G.t += dt
      const k = Math.min(1, G.t / G.dur)
      if (k >= 1) {
        this.hideGolden()
      } else {
        this._gp = this._gp || [new THREE.Vector3(), new THREE.Vector3()]
        this._gp[0].lerpVectors(G.a, G.b, k)
        this._gp[0].y += Math.sin(k * Math.PI * 3) * 1.6
        this.goldenG.position.copy(this._gp[0])
        this._gp[1].lerpVectors(G.a, G.b, Math.min(1, k + 0.02))
        this._gp[1].y += Math.sin(Math.min(1, k + 0.02) * Math.PI * 3) * 1.6
        this.goldenG.lookAt(this._gp[1])
        const flap = Math.sin(t * 15) * 0.9
        this.goldenG.userData.wings[0].rotation.x = -flap
        this.goldenG.userData.wings[1].rotation.x = flap
      }
    } else if (!this.goldenG.visible) {
      this.goldenT -= dt
      if (this.goldenT <= 0) this.startGolden()
    }
  }

  _dragonPoint(u, out) {
    out.set(
      Math.cos(u * 0.9) * 17 + Math.sin(u * 1.7) * 3.5,
      21 + Math.sin(u * 1.31) * 4.5 + Math.sin(u * 0.47) * 2,
      Math.sin(u * 0.62) * 14 + Math.cos(u * 1.13) * 4
    )
    return out
  }
}
