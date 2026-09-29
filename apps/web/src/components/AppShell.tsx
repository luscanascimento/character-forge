import { NavLink, Outlet } from 'react-router-dom'
import { BrandMark } from './BrandMark'

const navigation = [
  { to: '/forge', label: 'Forge' },
  { to: '/compendium', label: 'Compendium' },
  { to: '/characters', label: 'My characters' },
] as const

export function AppShell() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <NavLink className="brand-link" to="/" aria-label="Character Forge home">
          <BrandMark />
          <span>Character Forge</span>
        </NavLink>
        <nav className="site-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  )
}
