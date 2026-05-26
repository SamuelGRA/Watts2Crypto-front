import { useEffect, useState } from 'react'
import {
  Calculator,
  Cpu,
  Layers,
  BookOpen,
  Zap,
  CircleDollarSign,
  Download,
  Moon,
  Sun,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import '../styles/main-layout.css'
import { MaintenanceBanner } from './MaintenanceBanner'

const navItems = [
  { to: '/', label: 'Calculadora', icon: Calculator, end: true },
  { to: '/hardware', label: 'Hardware', icon: Cpu },
  { to: '/software', label: 'Software', icon: Download },
  { to: '/electricity', label: 'Electricidad', icon: Zap },
  { to: '/currencies', label: 'Divisas', icon: CircleDollarSign },
  { to: '/pools', label: 'Pools', icon: Layers },
  { to: '/guide', label: 'Guía', icon: BookOpen },
]

export function MainLayout() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = localStorage.getItem('w2c-theme')
    return savedTheme === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('w2c-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div className="main-layout">
      <header className="top-header">
        <div className="container top-header__inner">
          <div>
            <h1>Watts2Crypto</h1>
            <p className="top-header__subtitle">
              Analiza la rentabilidad de tu minería de criptomonedas
            </p>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
          </button>
        </div>
      </header>

      <nav className="tabs-nav" aria-label="Navegacion principal">
        <div className="container tabs-nav__list">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `tab-link${isActive ? ' tab-link--active' : ''}`
                }
              >
                <Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      <main className="container content-shell">
        <MaintenanceBanner />
        <Outlet />
      </main>
    </div>
  )
}