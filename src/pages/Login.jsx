// Login for the whole site (Supabase e-mail + password). The database decides who may
// change data (see supabase/migrations/002); this page only asks who you are.
import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase.js'

/** The logged-in session: undefined while checking, null when logged out. */
export function useSession() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    if (!supabase) return setSession(null)
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

export default function Login() {
  const [mode, setMode] = useState('in') // 'in' = log in, 'up' = create account
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!supabase) return setMessage('Supabase is not configured (see .env).')
    setBusy(true)
    setMessage('')
    const { data, error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) return setMessage(error.message)
    // With e-mail confirmation on, sign-up returns no session until the link is clicked.
    if (mode === 'up' && !data.session) setMessage('Account made. Open the link in the e-mail we sent, then log in.')
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <span className="brand">Soul Link</span>
        <h2>{mode === 'in' ? 'Log in' : 'Create account'}</h2>
        <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {message && <p className="status" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'in' ? 'Log in' : 'Create account'}</button>
        <button type="button" className="link-button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMessage('') }}>
          {mode === 'in' ? 'No account yet? Create one' : 'Have an account? Log in'}
        </button>
        <p className="status small-print">Only the two players on the run’s list can change anything. Other accounts can look, not edit.</p>
      </form>
    </div>
  )
}
