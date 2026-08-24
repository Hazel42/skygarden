const CHIME_NOTES = [1046.5, 1174.7, 1318.5, 1568, 1760]
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.5]
const CHORDS = [
  [130.81, 196.0, 329.63],
  [110.0, 164.81, 261.63],
  [87.31, 130.81, 220.0],
  [98.0, 146.83, 246.94]
]

class AudioEngine {
  constructor() {
    this.ok = false
    this.muted = false
    this.chordIdx = 0
  }

  init() {
    if (this.ok) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = (this.ctx = new AC())
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)

    this.verb = ctx.createConvolver()
    this.verb.buffer = this._ir(2.8, 2.6)
    const vg = ctx.createGain(); vg.gain.value = 0.55
    this.verb.connect(vg); vg.connect(this.master)

    this.amb = ctx.createGain(); this.amb.gain.value = 0.9; this.amb.connect(this.master)
    const ambV = ctx.createGain(); ambV.gain.value = 0.25
    this.amb.connect(ambV); ambV.connect(this.verb)

    this.mus = ctx.createGain(); this.mus.gain.value = 0.42; this.mus.connect(this.master)
    const musV = ctx.createGain(); musV.gain.value = 0.45
    this.mus.connect(musV); musV.connect(this.verb)

    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.85; this.sfx.connect(this.master)
    const sfxV = ctx.createGain(); sfxV.gain.value = 0.4
    this.sfx.connect(sfxV); sfxV.connect(this.verb)

    this.noiseBuf = this._noise(3)
    this._startWater()
    this._startWind()
    this._startRain()

    this.delay = ctx.createDelay(1)
    this.delay.delayTime.value = 0.38
    const fb = ctx.createGain(); fb.gain.value = 0.33
    this.delay.connect(fb); fb.connect(this.delay)
    const dOut = ctx.createGain(); dOut.gain.value = 0.5
    this.delay.connect(dOut); dOut.connect(this.mus); dOut.connect(this.verb)

    this.ok = true
    this._loop('music', () => this._pad(), 8000, 9500, 1)
    this._loop('pluck', () => { if (Math.random() < 0.6) this.pluck(SCALE[(Math.random() * SCALE.length) | 0] * (Math.random() < 0.3 ? 0.5 : 1), 0.07) }, 3400, 8600, 0.75)
    this._loop('chime', () => { if (Math.random() < 0.72) this.chime() }, 2600, 8200, 0.8)
  }

  _ir(dur, decay) {
    const sr = this.ctx.sampleRate
    const len = Math.floor(sr * dur)
    const buf = this.ctx.createBuffer(2, len, sr)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  _noise(sec) {
    const sr = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(1, sr * sec, sr)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.997 * b0 + w * 0.03
      b1 = 0.985 * b1 + w * 0.06
      b2 = 0.95 * b2 + w * 0.12
      d[i] = (b0 + b1 + b2 + w * 0.08) * 0.6
    }
    return buf
  }

  _startWater() {
    const c = this.ctx
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 430; lp.Q.value = 0.6
    const g = c.createGain(); g.gain.value = 0.05
    src.connect(lp); lp.connect(g); g.connect(this.amb); src.start()
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07
    const lg = c.createGain(); lg.gain.value = 150
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start()
  }

  _startWind() {
    const c = this.ctx
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.45
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.5
    const g = c.createGain(); g.gain.value = 0.026
    src.connect(bp); bp.connect(g); g.connect(this.amb); src.start()
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05
    const lg = c.createGain(); lg.gain.value = 170
    lfo.connect(lg); lg.connect(bp.frequency); lfo.start()
  }

  _startRain() {
    const c = this.ctx
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500
    this.rainG = c.createGain(); this.rainG.gain.value = 0
    src.connect(hp); hp.connect(this.rainG); this.rainG.connect(this.amb); src.start()
  }

  _loop(name, fn, minMs, maxMs, chance) {
    const tickFn = () => {
      if (!this.ok) return
      if (!document.hidden && !this.muted && Math.random() < chance) {
        try { fn() } catch (e) { }
      }
      setTimeout(tickFn, minMs + Math.random() * (maxMs - minMs))
    }
    setTimeout(tickFn, minMs + Math.random() * (maxMs - minMs))
  }

  chime(vol = 0.09) {
    if (!this.ok) return
    const c = this.ctx, t = c.currentTime
    const f = CHIME_NOTES[(Math.random() * CHIME_NOTES.length) | 0]
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2)
    const o1 = c.createOscillator(); o1.frequency.value = f
    const o2 = c.createOscillator(); o2.frequency.value = f * 2.756
    const g2 = c.createGain(); g2.gain.value = 0.22
    o1.connect(g); o2.connect(g2); g2.connect(g)
    let out = g
    if (c.createStereoPanner) {
      const pan = c.createStereoPanner()
      pan.pan.value = Math.random() * 1.5 - 0.75
      g.connect(pan); out = pan
    }
    out.connect(this.amb); out.connect(this.verb)
    o1.start(t); o2.start(t)
    o1.stop(t + 3.4); o2.stop(t + 3.4)
  }

  pluck(freq, vol = 0.1, echo = true) {
    if (!this.ok) return
    const c = this.ctx, t = c.currentTime
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5)
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2
    const g2 = c.createGain(); g2.gain.value = 0.18
    o.connect(g); o2.connect(g2); g2.connect(g)
    g.connect(this.mus)
    if (echo) g.connect(this.delay)
    o.start(t); o2.start(t)
    o.stop(t + 1.6); o2.stop(t + 1.6)
  }

  _pad() {
    if (!this.ok) return
    const c = this.ctx, t = c.currentTime
    const chord = CHORDS[this.chordIdx++ % CHORDS.length]
    for (const f of chord) {
      for (const det of [-4, 4]) {
        const o = c.createOscillator()
        o.type = 'triangle'; o.frequency.value = f; o.detune.value = det
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 720
        const g = c.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.linearRampToValueAtTime(0.028, t + 3.2)
        g.gain.setValueAtTime(0.028, t + 6.5)
        g.gain.linearRampToValueAtTime(0.0001, t + 11)
        o.connect(lp); lp.connect(g); g.connect(this.mus)
        o.start(t); o.stop(t + 11.2)
      }
    }
  }

  tap(combo = 0) {
    if (!this.ok || this.muted) return
    const c = this.ctx, t = c.currentTime
    const f = 523.25 * (1 + Math.min(combo, 24) * 0.02)
    this.pluck(f, 0.05)
    const th = c.createOscillator(); th.frequency.value = 164
    const tg = c.createGain()
    tg.gain.setValueAtTime(0.0001, t)
    tg.gain.exponentialRampToValueAtTime(0.08, t + 0.012)
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
    th.connect(tg); tg.connect(this.sfx)
    th.start(t); th.stop(t + 0.26)
    const n = c.createBufferSource(); n.buffer = this.noiseBuf
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.0001, t)
    ng.gain.exponentialRampToValueAtTime(0.035, t + 0.006)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    n.connect(hp); hp.connect(ng); ng.connect(this.sfx)
    n.start(t); n.stop(t + 0.16)
  }

  buy() {
    if (!this.ok || this.muted) return
    this.pluck(659.25, 0.07)
    setTimeout(() => this.pluck(987.77, 0.07), 90)
  }

  unlock() {
    if (!this.ok || this.muted) return
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => this.pluck(f, 0.075), i * 95)
    })
    setTimeout(() => this.chime(0.11), 420)
  }

  levelUp() {
    if (!this.ok || this.muted) return
    ;[392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => this.pluck(f, 0.08), i * 110)
    })
    setTimeout(() => this.chime(0.12), 600)
  }

  gong() {
    if (!this.ok || this.muted) return
    const c = this.ctx, t = c.currentTime
    const partials = [[98, 0.085], [147, 0.05], [196, 0.042], [241, 0.03], [322, 0.02]]
    for (const [f, v] of partials) {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.01)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(v, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6)
      o.connect(g); g.connect(this.sfx); g.connect(this.verb)
      o.start(t); o.stop(t + 3.8)
    }
    const n = c.createBufferSource(); n.buffer = this.noiseBuf
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.0001, t)
    ng.gain.exponentialRampToValueAtTime(0.05, t + 0.008)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    n.connect(bp); bp.connect(ng); ng.connect(this.sfx); ng.connect(this.verb)
    n.start(t); n.stop(t + 0.55)
  }

  dragonCall() {    if (!this.ok || this.muted) return
    const c = this.ctx, t = c.currentTime
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(52, t + 1.7)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 2.4
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9)
    o.connect(lp); lp.connect(g); g.connect(this.sfx); g.connect(this.verb)
    o.start(t); o.stop(t + 2)
    const n = c.createBufferSource(); n.buffer = this.noiseBuf
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 1.2
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.0001, t)
    ng.gain.exponentialRampToValueAtTime(0.03, t + 0.4)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    n.connect(bp); bp.connect(ng); ng.connect(this.amb)
    n.start(t); n.stop(t + 1.7)
  }

  setRain(on) {
    if (!this.ok) return
    const g = this.rainG.gain, t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(on ? 0.085 : 0, t + 2.2)
  }

  setMuted(m) {
    this.muted = m
    if (!this.ok) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setValueAtTime(this.master.gain.value, t)
    this.master.gain.linearRampToValueAtTime(m ? 0 : 0.9, t + 0.4)
  }

  resume() {
    if (this.ok && this.ctx.state === 'suspended') this.ctx.resume()
  }
}

export const audio = new AudioEngine()
