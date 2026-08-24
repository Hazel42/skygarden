import * as THREE from 'three'
import { mulberry32 } from './voxel.js'

function fluffTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const r = g.createRadialGradient(64, 64, 6, 64, 64, 62)
  r.addColorStop(0, 'rgba(255,255,255,.95)')
  r.addColorStop(0.55, 'rgba(255,255,255,.5)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makePoints(count, spreadSeed, size, opacity) {
  const rng = mulberry32(spreadSeed)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const rr = 42 + Math.pow(rng(), 0.8) * 105
    pos[i * 3] = Math.cos(a) * rr
    pos[i * 3 + 1] = -7 + rng() * 7
    pos[i * 3 + 2] = Math.sin(a) * rr
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    map: fluffTex(), size, sizeAttenuation: true,
    transparent: true, opacity, depthWrite: false
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  return pts
}

function makeClumps(totalBoxes, seed, rMin, rMax, yMin, yMax, sMin, sMax) {
  const rng = mulberry32(seed)
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: '#FDFDFF' }),
    totalBoxes
  )
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  let placed = 0
  while (placed < totalBoxes) {
    const a = rng() * Math.PI * 2
    const rr = rMin + Math.pow(rng(), 0.85) * (rMax - rMin)
    const cx = Math.cos(a) * rr
    const cz = Math.sin(a) * rr
    const cy = yMin + rng() * (yMax - yMin)
    const clump = 7 + Math.floor(rng() * 9)
    const base = sMin + rng() * (sMax - sMin)
    for (let i = 0; i < clump && placed < totalBoxes; i++) {
      p.set(
        cx + (rng() * 2 - 1) * base * 2.1,
        cy + (rng() * 2 - 1) * base * 0.55,
        cz + (rng() * 2 - 1) * base * 2.1
      )
      const sc = base * (0.55 + rng() * 0.75)
      s.set(sc, sc * 0.62, sc)
      m.compose(p, q, s)
      mesh.setMatrixAt(placed++, m)
    }
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  return mesh
}

export function createCloudSea(scene) {
  const group = new THREE.Group()
  scene.add(group)

  const DAY_COL = new THREE.Color('#FFFFFF')
  const NIGHT_COL = new THREE.Color('#9FAECF')
  const _c = new THREE.Color()

  const layerA = makeClumps(560, 11, 46, 135, -6.5, -2.5, 1.7, 3.4)
  const fluffA = makePoints(260, 21, 34, 0.5)
  layerA.add(fluffA)

  const layerB = makeClumps(430, 22, 62, 150, -4.5, -0.5, 2.1, 4.2)
  const fluffB = makePoints(210, 33, 52, 0.42)
  layerB.add(fluffB)

  const denseA = makeClumps(420, 44, 40, 120, -3.5, 1.4, 1.9, 3.8)
  denseA.visible = false
  const fluffC = makePoints(170, 55, 40, 0.45)
  fluffC.visible = false
  denseA.add(fluffC)

  group.add(layerA, layerB, denseA)

  return {
    group,
    setDense(v) {
      denseA.visible = v
      fluffC.visible = v
    },
    setNight(nf) {
      _c.copy(DAY_COL).lerp(NIGHT_COL, nf)
      fluffA.material.color.copy(_c)
      fluffB.material.color.copy(_c)
      fluffC.material.color.copy(_c)
      fluffA.material.opacity = 0.5 - nf * 0.16
      fluffB.material.opacity = 0.42 - nf * 0.14
      fluffC.material.opacity = 0.45 - nf * 0.14
    },
    update(dt) {
      layerA.rotation.y += dt * 0.0045
      layerB.rotation.y -= dt * 0.0032
      denseA.rotation.y += dt * 0.0038
      group.position.y = Math.sin(performance.now() * 0.00008) * 0.35
    }
  }
}
