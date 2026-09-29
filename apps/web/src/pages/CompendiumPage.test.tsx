import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CompendiumPage from './CompendiumPage'

const page = {
  items: [
    { id: 'fighter', name: 'Fighter', category: 'classes' },
    { id: 'wizard', name: 'Wizard', category: 'classes' },
  ],
  page: 1,
  pageSize: 24,
  total: 2,
  totalPages: 1,
  source: {
    provider: 'D&D 5e SRD API',
    ruleset: '2024',
    rulesVersion: 'SRD-5.2.1',
    fetchedAt: '2026-09-28T12:00:00Z',
  },
}

function renderCompendium(path = '/compendium/classes') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/compendium/:category" element={<CompendiumPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CompendiumPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders normalized catalog entries and their source', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    renderCompendium()

    expect(await screen.findByRole('heading', { name: 'Wizard' })).toBeInTheDocument()
    expect(screen.getByText(/SRD-5\.2\.1 · D&D 5e SRD API/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explore Wizard' })).toHaveAttribute(
      'href',
      '/compendium/classes/wizard',
    )
  })

  it('sends an explicit search query and preserves navigation state', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const user = userEvent.setup()
    renderCompendium()

    await screen.findByRole('heading', { name: 'Wizard' })
    await user.type(screen.getByRole('textbox', { name: 'Search Classes' }), 'wiz')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('search=wiz'))).toBe(true)
  })

  it('shows a recoverable error state when the provider is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }))

    renderCompendium()

    expect(await screen.findByText(/archive doors are sealed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
