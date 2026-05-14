import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { GlucoseReading, GlucoseStats } from '../types'

export function useGlucose() {
  const queryClient = useQueryClient()

  const { data: readings, isLoading: loadingReadings } = useQuery<GlucoseReading[]>({
    queryKey: ['glucose-readings'],
    queryFn: async () => {
      const { data } = await api.get('/glucose/readings', { params: { limit: 1000 } })
      return data
    },
  })

  const statsQuery = (start?: string, end?: string) =>
    useQuery<GlucoseStats>({
      queryKey: ['glucose-stats', start, end],
      queryFn: async () => {
        const params: Record<string, string> = {}
        if (start) params.start = start
        if (end) params.end = end
        const { data } = await api.get('/glucose/stats', { params })
        return data
      },
    })

  const { data: syncStatus } = useQuery<{ last_sync: string | null; total_readings: number }>({
    queryKey: ['glucose-sync-status'],
    queryFn: async () => {
      const { data } = await api.get('/glucose/sync/status')
      return data
    },
    refetchInterval: 30000,
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/glucose/sync')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glucose-readings'] })
      queryClient.invalidateQueries({ queryKey: ['glucose-sync-status'] })
      queryClient.invalidateQueries({ queryKey: ['glucose-stats'] })
    },
  })

  const { data: config } = useQuery<{ nightscout_url: string; configured: boolean }>({
    queryKey: ['glucose-config'],
    queryFn: async () => {
      const { data } = await api.get('/glucose/config')
      return data
    },
  })

  const configMutation = useMutation({
    mutationFn: async (payload: { nightscout_url: string; api_token: string }) => {
      await api.post('/glucose/config', payload)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['glucose-config'] }),
  })

  return { readings, loadingReadings, statsQuery, syncStatus, syncMutation, config, configMutation }
}
