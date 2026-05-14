import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { DashboardStats, GlucoseReading } from '../types'

export function useDashboard() {
  const stats = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/stats')
      return data
    },
    refetchInterval: 60000,
  })

  const glucoseHistory = useQuery<GlucoseReading[]>({
    queryKey: ['dashboard-glucose-history'],
    queryFn: async () => {
      const { data } = await api.get('/glucose/readings', { params: { limit: 200 } })
      return data
    },
    staleTime: 60000,
  })

  return { ...stats, glucoseHistory }
}
