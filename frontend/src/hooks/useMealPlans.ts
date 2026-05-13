import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { MealPlan, ShoppingListItem } from '../types'

export function useMealPlans() {
  const queryClient = useQueryClient()

  const { data: plans, isLoading } = useQuery<MealPlan[]>({
    queryKey: ['meal-plans'],
    queryFn: async () => {
      const { data } = await api.get('/meal-plans/')
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: { week_start: string; title: string; entries: Array<{ recipe_id: number; day_of_week: number; meal_slot: string; serving_count?: number }> }) => {
      const { data } = await api.post('/meal-plans/', payload)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meal-plans'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/meal-plans/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meal-plans'] }),
  })

  const shoppingListQuery = (planId: number) =>
    useQuery<ShoppingListItem[]>({
      queryKey: ['shopping-list', planId],
      queryFn: async () => {
        const { data } = await api.get(`/meal-plans/${planId}/shopping-list`)
        return data
      },
      enabled: !!planId,
    })

  return { plans, isLoading, createMutation, deleteMutation, shoppingListQuery }
}
