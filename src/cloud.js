import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ])
}

export const cloud = {
  ok: false,
  sb: null,
  uid: null,

  async init() {
    if (!url || !key) return false
    try {
      this.sb = createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true }
      })
      const { data, error } = await withTimeout(this.sb.auth.signInAnonymously(), 4000)
      if (error) throw error
      this.uid = data.user.id
      this.ok = true
      return true
    } catch (e) {
      console.warn('[cloud] disabled:', e?.message || e)
      this.ok = false
      return false
    }
  },

  async pull() {
    if (!this.ok) return null
    try {
      const { data, error } = await withTimeout(
        this.sb.from('garden_saves').select('data').eq('user_id', this.uid).maybeSingle(),
        3500
      )
      if (error) throw error
      return data?.data ?? null
    } catch {
      return null
    }
  },

  async push(obj) {
    if (!this.ok) return false
    try {
      const { error } = await withTimeout(
        this.sb.from('garden_saves').upsert({
          user_id: this.uid,
          data: obj,
          updated_at: new Date().toISOString()
        }),
        3500
      )
      return !error
    } catch {
      return false
    }
  }
}
