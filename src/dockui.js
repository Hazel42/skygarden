import * as THREE from 'three'

export class DockUI {
  constructor() {
    this.current = null
    this.registry = new Map()
    this._v = new THREE.Vector3()
  }

  register(key, anchor) {
    this.registry.set(key, anchor)
  }

  attach(key, el) {
    const anchor = this.registry.get(key)
    if (!anchor) return
    this.current = { key, el, anchor }
    el.classList.add('docked')
  }

  detach(el) {
    if (this.current && (!el || this.current.el === el)) {
      this.current.el.classList.remove('docked')
      this.current.el.style.transform = ''
      this.current = null
    }
  }

  update() {
    if (!this.current) return
    const { el, anchor } = this.current
    if (el.classList.contains('hidden')) return
    this._v.copy(anchor).project(this.camera)
    if (this._v.z > 1) {
      el.style.opacity = '0'
      return
    }
    el.style.opacity = ''
    const sx = (this._v.x * 0.5 + 0.5) * window.innerWidth
    const sy = (-this._v.y * 0.5 + 0.5) * window.innerHeight
    const w = el.offsetWidth || 320
    const h = el.offsetHeight || 380
    let x = sx < window.innerWidth / 2 ? sx + 42 : sx - w - 42
    x = Math.max(10, Math.min(window.innerWidth - w - 10, x))
    let y = Math.max(74, Math.min(window.innerHeight - h - 118, sy - h / 2))
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
  }
}
