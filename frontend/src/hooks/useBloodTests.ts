import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { BloodTest, MarkerCreate } from '../types'

export function useBloodTests() {
  const queryClient = useQueryClient()

  const { data: tests, isLoading } = useQuery<BloodTest[]>({
    queryKey: ['blood-tests'],
    queryFn: async () => {
      const { data } = await api.get('/blood-tests/')
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: { date_tested: string; lab_name?: string; notes?: string; markers: MarkerCreate[] }) => {
      const { data } = await api.post('/blood-tests/', payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blood-tests'] }),
  })

  const uploadPdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/blood-tests/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
  })

  const parsePdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/blood-tests/parse-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/blood-tests/${id}`)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blood-tests'] }),
  })

  const trendsQuery = (markerName: string) =>
    useQuery({
      queryKey: ['trends', markerName],
      queryFn: async () => {
        const { data } = await api.get('/blood-tests/markers/trends', { params: { marker_name: markerName } })
        return data
      },
      enabled: markerName.length > 0,
    })

  return { tests, isLoading, createMutation, uploadPdfMutation, parsePdfMutation, deleteMutation, trendsQuery }
}
