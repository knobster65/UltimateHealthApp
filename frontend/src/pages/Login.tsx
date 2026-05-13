import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'

export default function Login() {
  const { user, login, setup } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSetup, setIsSetup] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (isSetup) {
        await setup(username, password)
      } else {
        await login(username, password)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Something went wrong'
      if (msg.includes('Account already exists')) {
        setIsSetup(false)
        setError('Account already exists. Please login.')
      } else {
        setError(msg)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow w-full max-w-sm space-y-5">
        <h1 className="text-xl font-bold text-gray-900 text-center">
          {isSetup ? 'Create Account' : 'Login'}
        </h1>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 font-medium"
        >
          {isSetup ? 'Create Account' : 'Login'}
        </button>

        <p className="text-xs text-center text-gray-500">
          {isSetup ? (
            <>Already have an account?{' '}
              <button type="button" onClick={() => setIsSetup(false)} className="text-primary-600">Login</button>
            </>
          ) : (
            <>First time?{' '}
              <button type="button" onClick={() => setIsSetup(true)} className="text-primary-600">Create account</button>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
