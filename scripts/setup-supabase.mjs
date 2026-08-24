import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
)

const TOKEN = env.SUPABASE_ACCESS_TOKEN
const REF = env.SUPABASE_PROJECT_REF
if (!TOKEN || !REF) {
  console.error('Missing SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF in .env')
  process.exit(1)
}

const api = (path, opt = {}) =>
  fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, {
    ...opt,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(opt.headers || {})
    }
  })

async function main() {
  process.stdout.write('1. Enabling anonymous sign-ins… ')
  const auth = await api('/config/auth', {
    method: 'PATCH',
    body: JSON.stringify({ external_anonymous_users_enabled: true })
  })
  console.log(auth.ok ? 'ok' : `HTTP ${auth.status} — ${await auth.text()}`)

  process.stdout.write('2. Creating garden_saves table + RLS… ')
  const sql = fs.readFileSync('supabase/schema.sql', 'utf8')
  const q = await api('/database/query', {
    method: 'POST',
    body: JSON.stringify({ query: sql })
  })
  console.log(q.ok ? 'ok' : `HTTP ${q.status} — ${await q.text()}`)

  process.stdout.write('3. Verifying table… ')
  const v = await api('/database/query', {
    method: 'POST',
    body: JSON.stringify({ query: "select count(*) from public.garden_saves" })
  })
  console.log(v.ok ? 'ok' : `HTTP ${v.status}`)
}

main().catch(e => { console.error('Setup failed:', e.message); process.exit(1) })
