import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RouteAccessibility } from './RouteAccessibility'
import { getRouteTitle } from './routeTitles'

describe('route accessibility', () => {
  it('provides concise titles for known and unknown routes', () => {
    expect(getRouteTitle('/')).toBe('Character Forge')
    expect(getRouteTitle('/characters/hero/sheet')).toBe('Character sheet | Character Forge')
    expect(getRouteTitle('/missing')).toBe('Page not found | Character Forge')
  })

  it('announces a client-side navigation and moves focus to main content', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <RouteAccessibility />
        <Link to="/characters">Open roster</Link>
        <main id="main-content" tabIndex={-1}>
          <Routes>
            <Route path="*" element={<h1>Page content</h1>} />
          </Routes>
        </main>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: 'Open roster' }))

    await waitFor(() => {
      expect(document.title).toBe('My characters | Character Forge')
      expect(screen.getByText('My characters')).toBeInTheDocument()
      expect(document.activeElement).toBe(screen.getByRole('main'))
    })
  })
})
