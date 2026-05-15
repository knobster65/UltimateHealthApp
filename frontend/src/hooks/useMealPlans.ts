import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { MealPlan, ShoppingListItem, MealPlanDetail, LatestPlanResponse } from '../types'

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

  const generateAIMealPlanMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/suggestions/generate')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['meal-plan-latest'] })
    },
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

  const planDetailQuery = (planId: number) =>
    useQuery<MealPlanDetail>({
      queryKey: ['meal-plan-detail', planId],
      queryFn: async () => {
        const { data } = await api.get(`/meal-plans/${planId}/view`)
        return data
      },
      enabled: !!planId,
    })

  const latestPlanQuery = useQuery<LatestPlanResponse>({
    queryKey: ['meal-plan-latest'],
    queryFn: async () => {
      const { data } = await api.get('/meal-plans/latest')
      return data
    },
  })

  return {
    plans, isLoading, createMutation, deleteMutation,
    generateAIMealPlanMutation, shoppingListQuery, planDetailQuery, latestPlanQuery,
  }
}
