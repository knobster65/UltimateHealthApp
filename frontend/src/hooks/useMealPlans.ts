import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import api from '../lib/api'
import type { MealPlan, ShoppingListItem, MealPlanDetail, LatestPlanResponse } from '../types'

export function useMealPlans() {
  const queryClient = useQueryClient()
  const [generatingPlanId, setGeneratingPlanId] = useState<number | null>(null)
  const [planDetail, setPlanDetail] = useState<MealPlanDetail | null>(null)

  const plansQuery = useQuery<MealPlan[]>({
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
      return data as { plan_id: number; plan_title: string; recipes_created: number }
    },
    onSuccess: async (data) => {
      // Immediately set the plan ID and fetch detail, then invalidate caches.
      setGeneratingPlanId(data.plan_id)
      setPlanDetail(null)
      try {
        const { data: detail } = await api.get(`/meal-plans/${data.plan_id}/view`)
        setPlanDetail(detail)
      } catch (e) {
        console.error('Failed to fetch plan detail:', e)
      }
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['meal-plan-latest'] })
    },
    onError: () => {
      setGeneratingPlanId(null)
      setPlanDetail(null)
    },
  })

  const resetGeneratingPlan = useCallback(() => {
    setGeneratingPlanId(null)
    setPlanDetail(null)
  }, [])

  const shoppingListQuery = (planId: number) =>
    useQuery<ShoppingListItem[]>({
      queryKey: ['shopping-list', planId],
      queryFn: async () => {
        const { data } = await api.get(`/meal-plans/${planId}/shopping-list`)
        return data
      },
      enabled: !!planId,
    })

  // Factory for PrintView and other consumers.
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
    plans: plansQuery.data, isLoading: plansQuery.isLoading, createMutation, deleteMutation,
    generateAIMealPlanMutation, generatingPlanId, planDetail, resetGeneratingPlan,
    shoppingListQuery, planDetailQuery, latestPlanQuery,
  }
}
