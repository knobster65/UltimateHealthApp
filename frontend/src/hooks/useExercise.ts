import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { ExerciseEntry, ExerciseSummary } from '../types'

export function useExercise() {
  const queryClient = useQueryClient()

  const { data: exercises, isLoading: loadingExercises } = useQuery<ExerciseEntry[]>({
    queryKey: ['exercises'],
    queryFn: async () => {
      const { data } = await api.get('/exercise/')
      return data
    },
  })

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/exercise/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  })

  const weeklySummaryQuery = (weekStart: string) =>
    useQuery<ExerciseSummary>({
      queryKey: ['exercise-summary', weekStart],
      queryFn: async () => {
        const { data } = await api.get('/exercise/summary', { params: { week_start: weekStart } })
        return data
      },
      enabled: weekStart.length > 0,
    })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/exercise/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  })

  return { exercises, loadingExercises, importMutation, weeklySummaryQuery, deleteMutation }
}
