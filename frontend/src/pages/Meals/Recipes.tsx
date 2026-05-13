import { useState } from 'react'
import { useRecipes } from '../../hooks/useRecipes'

const categories = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert']
const glycemicRatings = ['Low', 'Medium', 'High']

export default function Recipes() {
  const { recipes, isLoading, createMutation, deleteMutation } = useRecipes()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prepTime, setPrepTime] = useState<number | undefined>()
  const [cookTime, setCookTime] = useState<number | undefined>()
  const [servings, setServings] = useState(1)
  const [category, setCategory] = useState<string>('')
  const [glycemic, setGlycemic] = useState<string>('')
  const [instructions, setInstructions] = useState('')
  const [tags, setTags] = useState('')
  const [ingredients, setIngredients] = useState<Array<{ name: string; quantity: number; unit: string; category?: string }>>([{ name: '', quantity: 0, unit: '' }])
  const [nutrition, setNutrition] = useState<Partial<{ calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; sugar_g: number }>>({})

  const resetForm = () => {
    setName(''); setDescription(''); setPrepTime(undefined); setCookTime(undefined)
    setServings(1); setCategory(''); setGlycemic(''); setInstructions('')
    setTags(''); setIngredients([{ name: '', quantity: 0, unit: '' }])
    setNutrition({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createMutation.mutateAsync({
        name, description: description || undefined, prep_time_min: prepTime, cook_time_min: cookTime,
        servings, category: category || undefined, glycemic_rating: glycemic ? glycemic.toLowerCase() : undefined,
        instructions, tags: tags || undefined,
        ingredients: ingredients.filter((i) => i.name.trim()),
        nutrition: nutrition.calories != null ? nutrition as any : undefined,
      })
      resetForm()
      setShowForm(false)
    } catch { /* handled by React Query */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Recipes</h1>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          {showForm ? 'Cancel' : '+ Add Recipe'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                <option value="">Select...</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time (min)</label>
              <input type="number" value={prepTime ?? ''} onChange={(e) => setPrepTime(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cook Time (min)</label>
              <input type="number" value={cookTime ?? ''} onChange={(e) => setCookTime(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
              <input type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Glycemic Rating</label>
            <select value={glycemic} onChange={(e) => setGlycemic(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
              <option value="">Select...</option>
              {glycemicRatings.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions *</label>
            <textarea required value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ingredients</label>
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="text" placeholder="Name" value={ing.name} onChange={(e) => {
                  const next = [...ingredients]; next[i] = { ...next[i], name: e.target.value }; setIngredients(next)
                }} className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <input type="number" step="any" placeholder="Qty" value={ing.quantity || ''} onChange={(e) => {
                  const next = [...ingredients]; next[i] = { ...next[i], quantity: Number(e.target.value) }; setIngredients(next)
                }} className="w-20 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <input type="text" placeholder="Unit" value={ing.unit} onChange={(e) => {
                  const next = [...ingredients]; next[i] = { ...next[i], unit: e.target.value }; setIngredients(next)
                }} className="w-20 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                {ingredients.length > 1 && (
                  <button type="button" onClick={() => setIngredients((p) => p.filter((_, j) => j !== i))}
                    className="text-red-500 text-sm px-2">X</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setIngredients((p) => [...p, { name: '', quantity: 0, unit: '' }])}
              className="text-sm text-primary-600 font-medium">+ Add Ingredient</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nutrition (per serving)</label>
            <div className="grid grid-cols-3 gap-3">
              {['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g'].map((key) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 capitalize">{key.replace('_g', ' (g)')}</label>
                  <input type="number" step="any" value={(nutrition as any)[key] ?? ''} onChange={(e) => setNutrition((p) => ({ ...p, [key]: e.target.value ? Number(e.target.value) : 0 }))}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={createMutation.isPending}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 text-sm disabled:opacity-50">
            {createMutation.isPending ? 'Saving...' : 'Save Recipe'}
          </button>
        </form>
      )}

      {!showForm && (
        <div className="flex gap-2 mb-4">
          <input type="text" placeholder="Search recipes..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 flex-1 max-w-xs" />
        </div>
      )}

      {isLoading ? <p className="text-gray-500">Loading...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(recipes || [])
            .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
            .map((recipe) => (
              <div key={recipe.id} className="bg-white rounded-xl shadow-sm border p-5 hover:border-primary-300 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
                  <button onClick={() => deleteMutation.mutate(recipe.id)}
                    className="text-gray-400 hover:text-red-600 text-sm shrink-0 ml-2">Delete</button>
                </div>
                {recipe.description && <p className="text-sm text-gray-500 mb-3">{recipe.description}</p>}
                <div className="flex gap-2 text-xs mb-3">
                  {recipe.category && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded capitalize">{recipe.category}</span>}
                  {recipe.glycemic_rating && <span className={`${recipe.glycemic_rating === 'low' ? 'bg-green-100 text-green-700' : recipe.glycemic_rating === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'} px-2 py-1 rounded capitalize`}>{recipe.glycemic_rating} GI</span>}
                  {recipe.prep_time_min && <span className="text-gray-400">{recipe.prep_time_min}m prep</span>}
                  {recipe.cook_time_min && <span className="text-gray-400">{recipe.cook_time_min}m cook</span>}
                </div>
                {recipe.nutrition && (
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{recipe.nutrition.calories} cal</span>
                    <span>P: {recipe.nutrition.protein_g}g</span>
                    <span>C: {recipe.nutrition.carbs_g}g</span>
                    <span>F: {recipe.nutrition.fat_g}g</span>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {!isLoading && recipes && recipes.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 border text-center">
          <p className="text-gray-500 mb-4">No recipes yet.</p>
          <button onClick={() => setShowForm(true)} className="text-primary-600 hover:underline text-sm font-medium">Add your first recipe</button>
        </div>
      )}
    </div>
  )
}
