const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

const AUTH_TIMEOUT = 5000
const DB_TIMEOUT = 4000

function fetchWithTimeout(timeoutMs) {
  return (input, init = {}) => {
    let signal = init.signal ?? null
    try {
      const t = AbortSignal.timeout(timeoutMs)
      if (signal) signal = AbortSignal.any([signal, t])
      else signal = t
    } catch (e) { /* older browsers: fall back to no signal */ }
    return fetch(input, { ...init, signal })
  }
}

export const cloud = {
  ok: false,
  sb: null,
  uid: null,
  email: null,
  isGuest: true,
  onChange: null,
  _initPromise: null,

  init() {
    if (this._initPromise) return this._initPromise
    this._initPromise = this._doInit()
    return this._initPromise
  },

  async _doInit() {
    if (!url || !key) return false
    try {
      const { createClient } = await import('@supabase/supabase-js')
      this.sb = createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true },
        db: { timeout: DB_TIMEOUT },
        global: { fetch: fetchWithTimeout(Math.max(AUTH_TIMEOUT, DB_TIMEOUT)) }
      })
      this.sb.auth.onAuthStateChange((event, session) => {
        this._applyUser(session?.user ?? null)
        if (event !== 'INITIAL_SESSION') this.onChange?.(event)
      })
      const { data, error } = await this.sb.auth.getSession()
      if (error) throw error
      if (data?.session?.user) {
        this._applyUser(data.session.user)
      } else {
        const anon = await this.sb.auth.signInAnonymously()
        if (anon.error) throw anon.error
        this._applyUser(anon.data.user)
      }
      this.ok = true
      return true
    } catch (e) {
      console.warn('[cloud] disabled:', e?.message || e)
      this.ok = false
      return false
    }
  },

  _applyUser(user) {
    this.uid = user?.id ?? null
    this.email = user?.email ?? null
    this.isGuest = !user || !!user.is_anonymous
  },

  async ensureSession() {
    if (!this.ok) return false
    if (this.uid) return true
    try {
      const anon = await this.sb.auth.signInAnonymously()
      if (anon.error) throw anon.error
      this._applyUser(anon.data.user)
      return true
    } catch (e) {
      console.warn('[cloud] guest session failed:', e?.message || e)
      this.ok = false
      return false
    }
  },

  async signUp(email, password) {
    if (!this.ok) return { error: new Error('cloud unavailable') }
    try {
      const res = await this.sb.auth.signUp({ email, password })
      if (res.error) return { error: res.error }
      return { needsConfirm: !res.data.session, user: res.data.user ?? null }
    } catch (e) {
      return { error: e }
    }
  },

  async signIn(email, password) {
    if (!this.ok) return { error: new Error('cloud unavailable') }
    try {
      const res = await this.sb.auth.signInWithPassword({ email, password })
      if (res.error) return { error: res.error }
      return { user: res.data.user ?? null }
    } catch (e) {
      return { error: e }
    }
  },

  async signOut() {
    if (!this.ok) return
    try { await this.sb.auth.signOut() } catch (e) { /* ignore */ }
  },

  async getProfile() {
    if (!this.ok || !this.uid) return null
    try {
      const q = this.sb.from('profiles').select('*').eq('id', this.uid).maybeSingle()
      const { data, error } = await (q.abortSignal ? q.abortSignal(AbortSignal.timeout(DB_TIMEOUT)) : q)
      if (error) throw error
      return data ?? null
    } catch {
      return null
    }
  },

  async saveProfile(patch) {
    if (!this.ok || !this.uid) return null
    try {
      const q = this.sb.from('profiles').update(patch).eq('id', this.uid).select().maybeSingle()
      const { data, error } = await (q.abortSignal ? q.abortSignal(AbortSignal.timeout(DB_TIMEOUT)) : q)
      if (error) throw error
      return data ?? null
    } catch {
      return null
    }
  },

  async pull() {
    if (!this.ok || !this.uid) return null
    try {
      const q = this.sb.from('garden_saves').select('data').eq('user_id', this.uid).maybeSingle()
      const { data, error } = await (q.abortSignal ? q.abortSignal(AbortSignal.timeout(DB_TIMEOUT)) : q)
      if (error) throw error
      return data?.data ?? null
    } catch {
      return null
    }
  },

  async push(obj) {
    if (!this.ok || !this.uid) return false
    try {
      const q = this.sb.from('garden_saves').upsert({
        user_id: this.uid,
        data: obj,
        updated_at: new Date().toISOString()
      })
      const { error } = await (q.abortSignal ? q.abortSignal(AbortSignal.timeout(DB_TIMEOUT)) : q)
      return !error
    } catch {
      return false
    }
  },

  async pushStats(stats) {
    if (!this.ok || !this.uid) return false
    try {
      const patch = {
        garden_level: Math.max(1, Math.floor(Number(stats.garden_level) || 1)),
        best_stage: Math.max(1, Math.floor(Number(stats.best_stage) || 1)),
        total_placed: Math.max(0, Math.floor(Number(stats.total_placed) || 0))
      }
      const q = this.sb.from('profiles').update(patch).eq('id', this.uid)
      const { error } = await (q.abortSignal ? q.abortSignal(AbortSignal.timeout(DB_TIMEOUT)) : q)
      return !error
    } catch {
      return false
    }
  },

  async fetchLeaderboard() {
    if (!this.ok) return null
    try {
      const q = this.sb.from('leaderboard').select('*').limit(20)
      const { data, error } = await (q.abortSignal ? q.abortSignal(AbortSignal.timeout(DB_TIMEOUT)) : q)
      if (error) return null
      return Array.isArray(data) ? data : null
    } catch {
      return null
    }
  }
}

export function isValidRemoteSave(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  if (typeof obj.e !== 'number' || !Number.isFinite(obj.e)) return false
  if (!obj.l || typeof obj.l !== 'object' || Array.isArray(obj.l)) return false
  for (const k in obj.l) {
    const v = obj.l[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return false
  }
  if (obj.last !== undefined && (!Number.isFinite(obj.last) || obj.last < 0)) return false
  return true
}
