const ITEMS = [
  { key: 'upgrades', icon: '✨', label: 'Blessings' },
  { key: 'build', icon: '🏪', label: 'Toko' },
  { key: 'tasks', icon: '📜', label: 'Tasks' },
  { key: 'photo', icon: '📷', label: 'Photo' },
  { key: 'help', icon: '?', label: 'Help' }
]

export class RadialMenu {
  constructor(onAction) {
    this.onAction = onAction
    this.isOpen = false
    const root = document.createElement('div')
    root.id = 'radial'
    root.innerHTML =
      `<div class="rc"></div>` +
      ITEMS.map((it, i) => {
        const a = -90 + i * (360 / ITEMS.length)
        return `<button class="ri" data-key="${it.key}" style="--a:${a}deg"><span>${it.icon}</span><em>${it.label}</em></button>`
      }).join('')
    document.body.appendChild(root)
    this.root = root
    root.querySelectorAll('.ri').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation()
        this.close()
        this.onAction(b.dataset.key)
      })
    })
    root.querySelector('.rc').addEventListener('click', () => this.close())
    setTimeout(() => root.classList.add('ready'), 50)
  }

  open(x, y) {
    if (this.isOpen) return
    this.isOpen = true
    const r = Math.min(120, window.innerWidth * 0.22)
    this.root.style.left = Math.max(r + 12, Math.min(window.innerWidth - r - 12, x)) + 'px'
    this.root.style.top = Math.max(r + 12, Math.min(window.innerHeight - r - 12, y)) + 'px'
    this.root.classList.add('open')
  }

  close() {
    if (!this.isOpen) return
    this.isOpen = false
    this.root.classList.remove('open')
  }
}
