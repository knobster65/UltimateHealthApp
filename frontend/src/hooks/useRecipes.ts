import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Recipe } from '../types'

export function useRecipes() {
  const queryClient = useQueryClient()

  const { data: recipes, isLoading } = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: async () => {
      const { data } = await api.get('/recipes/')
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string; description?: string; prep_time_min?: number; cook_time_min?: number
      servings: number; category?: string; glycemic_rating?: string; instructions: string
      tags?: string; ingredients: Array<{ name: string; quantity: number; unit: string; category?: string }>
      nutrition?: { calories: number; protein_g?: number; carbs_g?: number; fat_g?: number; fiber_g?: number; sugar_g?: number }
    }) => {
      const { data } = await api.post('/recipes/', payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/recipes/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  })

  return { recipes, isLoading, createMutation, deleteMutation }
}
