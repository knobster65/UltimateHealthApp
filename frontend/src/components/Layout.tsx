import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'

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
    { label: 'Suggestions', path: '/meals/suggestions' },
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

function MoonIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

export default function Layout({ children }: LayoutProps) {
  const { logout, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  const sectionPrefixes = ['/blood-tests', '/meals', '/glucose', '/exercise']

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] transition-colors duration-200">
      <header className="bg-[var(--bg-surface)] shadow-sm border-b border-[var(--border-default)] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Ultimate Health App</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <span className="text-sm text-[var(--text-secondary)]">{user?.username}</span>
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
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--bg-accent)] text-primary-700 dark:text-primary-400'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}>
                {item.label}
              </Link>
            )
          })}

          {sectionNavs.map((section) => {
            const prefix = section.children[0]?.path || ''
            const sectionActive = isSectionActive(prefix, location.pathname)
            return (
              <div key={prefix}>
                <h3 className={`text-xs font-semibold uppercase tracking-wide px-3 mb-1 ${
                  sectionActive ? 'text-primary-600 dark:text-primary-400' : 'text-[var(--text-muted)]'
                }`}>
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.children.map((child) => {
                    const active = location.pathname === child.path || (child.path !== prefix && location.pathname.startsWith(child.path))
                    return (
                      <li key={child.path}>
                        <Link to={child.path}
                          className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            active
                              ? 'text-primary-700 dark:text-primary-400 bg-[var(--bg-accent)] font-medium'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`}>
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
