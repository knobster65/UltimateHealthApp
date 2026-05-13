import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { label: 'Dashboard', path: '/' },
]

const sectionNavs = [
  { title: 'Blood Tests', children: [
    { label: 'All Tests', path: '/blood-tests' },
    { label: 'Upload', path: '/blood-tests/upload' },
    { label: 'Trends', path: '/blood-tests/trends' },
  ]},
  { title: 'Meals', children: [
    { label: 'Recipes', path: '/meals/recipes' },
    { label: 'Meal Plans', path: '/meals/plans' },
    { label: 'Shopping List', path: '/meals/shopping' },
  ]},
  { title: 'Glucose', children: [
    { label: 'Overview', path: '/glucose' },
  ]},
  { title: 'Exercise', children: [
    { label: 'Workouts', path: '/exercise' },
  ]},
]

function isSectionActive(path: string, location: string) {
  return path === '/' ? location === '/' : location.startsWith(path)
}

interface LayoutProps {
  children?: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { logout, user } = useAuth()
  const location = useLocation()

  const sectionPrefixes = ['/blood-tests', '/meals', '/glucose', '/exercise']

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Ultimate Health App</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.username}</span>
            <button onClick={logout} className="text-sm text-red-600 hover:text-red-700">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        <nav className="w-48 shrink-0 space-y-4">
          {navItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <Link key={item.path} to={item.path}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${active ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                {item.label}
              </Link>
            )
          })}

          {sectionNavs.map((section) => {
            const prefix = section.children[0]?.path || ''
            const sectionActive = isSectionActive(prefix, location.pathname)
            return (
              <div key={prefix}>
                <h3 className={`text-xs font-semibold uppercase tracking-wide px-3 mb-1 ${sectionActive ? 'text-primary-600' : 'text-gray-400'}`}>
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.children.map((child) => {
                    const active = location.pathname === child.path || (child.path !== prefix && location.pathname.startsWith(child.path))
                    return (
                      <li key={child.path}>
                        <Link to={child.path}
                          className={`block px-3 py-1.5 rounded-lg text-sm ${active ? 'text-primary-700 bg-primary-50 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                          {child.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        <main className="flex-1 min-w-0">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  )
}
