import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import api from '../lib/api'

export default function Login() {
  const { user, login, signup } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [needSetup, setNeedSetup] = useState(true)

  useEffect(() => {
    api.get('/auth/setup-check')
      .then(({ data }) => setNeedSetup(!data.account_exists))
      .catch(() => {})
  }, [])

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (isSignup) {
        await signup(username, password)
      } else {
        await login(username, password)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Something went wrong'
      setError(msg)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
      <form onSubmit={handleSubmit} className="bg-[var(--bg-surface)] p-8 rounded-xl shadow w-full max-w-sm space-y-5 border border-[var(--border-default)]">
        <h1 className="text-xl font-bold text-[var(--text-primary)] text-center">
          {isSignup ? 'Create Account' : 'Login'}
        </h1>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-2 rounded">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Username</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 font-medium"
        >
          {isSignup ? 'Create Account' : 'Login'}
        </button>

        <p className="text-xs text-center text-[var(--text-muted)]">
          {isSignup ? (
            <>Already have an account?{' '}
              <button type="button" onClick={() => setIsSignup(false)} className="text-primary-600 dark:text-primary-400">Login</button>
            </>
          ) : (
            <>New user?{' '}
              <button type="button" onClick={() => setIsSignup(true)} className="text-primary-600 dark:text-primary-400">Create account</button>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
