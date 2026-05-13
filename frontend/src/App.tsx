import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import BloodTestsIndex from './pages/BloodTests/Index'
import BloodTestsUpload from './pages/BloodTests/Upload'
import BloodTestsTrends from './pages/BloodTests/Trends'
import Recipes from './pages/Meals/Recipes'
import MealPlan from './pages/Meals/MealPlan'
import ShoppingList from './pages/Meals/ShoppingList'
import GlucoseIndex from './pages/Glucose/Index'
import ExerciseIndex from './pages/Exercise/Index'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/blood-tests" element={<ProtectedRoute><BloodTestsIndex /></ProtectedRoute>} />
          <Route path="/blood-tests/upload" element={<ProtectedRoute><BloodTestsUpload /></ProtectedRoute>} />
          <Route path="/blood-tests/trends" element={<ProtectedRoute><BloodTestsTrends /></ProtectedRoute>} />
          <Route path="/meals/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
          <Route path="/meals/plans" element={<ProtectedRoute><MealPlan /></ProtectedRoute>} />
          <Route path="/meals/shopping" element={<ProtectedRoute><ShoppingList /></ProtectedRoute>} />
          <Route path="/glucose" element={<ProtectedRoute><GlucoseIndex /></ProtectedRoute>} />
          <Route path="/exercise" element={<ProtectedRoute><ExerciseIndex /></ProtectedRoute>} />
          <Route path="/*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
