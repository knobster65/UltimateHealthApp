import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import type { UserInfo } from '../types'

export function useAuth() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const checkSession = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get('/auth/session')
      setUser(data)
    } catch {
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem('token', data.token)
    setUser({ id: 0, username })
  }

  const signup = async (username: string, password: string) => {
    const { data } = await api.post('/auth/signup', { username, password })
    localStorage.setItem('token', data.token)
    setUser({ id: 0, username })
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      localStorage.removeItem('token')
      setUser(null)
    }
  }

  return { user, loading, login, signup, logout, checkSession }
}
