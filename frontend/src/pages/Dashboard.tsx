import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard title="Blood Tests" link="/blood-tests" description="View & upload test results" />
        <DashboardCard title="Meal Plans" link="/meals/recipes" description="Recipes & shopping lists" />
        <DashboardCard title="Glucose" link="/glucose" description="CGM readings & trends" />
        <DashboardCard title="Exercise" link="/exercise" description="Workout history" />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Ultimate Health App</h2>
        <p className="text-gray-600 text-sm">
          Start by uploading blood test results, adding recipes, configuring Nightscout sync, or importing exercise data.
        </p>
      </div>
    </div>
  )
}

function DashboardCard({ title, link, description }: { title: string; link: string; description: string }) {
  return (
    <Link to={link} className="bg-white rounded-xl shadow-sm p-5 border hover:border-primary-300 transition-colors">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </Link>
  )
}
