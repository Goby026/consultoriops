import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = readFileSync('D:/PROYECTOS/IA/opencode/consultoriops/.env.local', 'utf8')
const get = (k) => env.split(/\r?\n/).find((l) => l.startsWith(k))?.split('=').slice(1).join('=').trim()
const c = createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY'))

const email = 'diag' + Date.now() + '@test.com'
const { data, error } = await c.auth.signUp({ email, password: 'Password123!' })
console.log('signUp ->', error ? 'ERROR: ' + error.message : 'OK id=' + data.user?.id)

const { data: login, error: loginErr } = await c.auth.signInWithPassword({ email, password: 'Password123!' })
console.log('signIn ->', loginErr ? 'ERROR: ' + loginErr.message : 'OK token=' + (login.session?.access_token?.slice(0, 12) ?? 'none'))

if (!loginErr) {
  const { data: me } = await c.from('user_profile').select('id, full_name, email').eq('id', login.user.id).maybeSingle()
  console.log('profile ->', me ? JSON.stringify(me) : 'nulo')
}
