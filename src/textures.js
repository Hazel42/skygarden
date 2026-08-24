import * as THREE from 'three'

function canvasTex(size, draw) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export const sparkTex = canvasTex(64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.25, 'rgba(255,255,255,.85)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, s, s)
})

export const petalTex = canvasTex(64, (g, s) => {
  g.translate(s / 2, s / 2)
  g.rotate(0.5)
  g.shadowColor = 'rgba(255,190,215,1)'
  g.shadowBlur = 10
  const r = g.createRadialGradient(0, 0, 2, 0, 0, 22)
  r.addColorStop(0, 'rgba(255,235,245,1)')
  r.addColorStop(0.7, 'rgba(255,185,215,.95)')
  r.addColorStop(1, 'rgba(255,160,200,0)')
  g.fillStyle = r
  g.beginPath()
  g.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2)
  g.fill()
})

export const dropTex = canvasTex(32, (g, s) => {
  const r = g.createLinearGradient(0, 0, 0, s)
  r.addColorStop(0, 'rgba(210,235,255,0)')
  r.addColorStop(0.5, 'rgba(210,235,255,.9)')
  r.addColorStop(1, 'rgba(210,235,255,0)')
  g.fillStyle = r
  g.fillRect(s / 2 - 2.5, 0, 5, s)
})

export const glowTex = canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.18, 'rgba(255,255,255,.6)')
  r.addColorStop(0.45, 'rgba(255,255,255,.18)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, s, s)
})
