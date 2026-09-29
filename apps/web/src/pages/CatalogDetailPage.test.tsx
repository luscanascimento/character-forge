import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CatalogDetailPage from './CatalogDetailPage'

describe('CatalogDetailPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders normalized attributes and safe emphasized text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'fireball',
          name: 'Fireball',
          category: 'spells',
          description: ['A **bright streak** flashes toward its target.'],
          textSections: [{ title: 'At Higher Levels', paragraphs: ['The damage increases.'] }],
          attributes: [
            { label: 'Level', value: '3' },
            { label: 'School', value: 'Evocation' },
          ],
          sections: [{ title: 'Classes', entries: [{ id: 'wizard', name: 'Wizard' }] }],
          source: {
            provider: 'D&D 5e SRD API',
            ruleset: '2024',
            rulesVersion: 'SRD-5.2.1',
            fetchedAt: '2026-09-28T12:00:00Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/compendium/spells/fireball']}>
          <Routes>
            <Route path="/compendium/:category/:id" element={<CatalogDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Fireball' })).toBeInTheDocument()
    expect(screen.getByText('bright streak', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Evocation')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'At Higher Levels' })).toBeInTheDocument()
    expect(screen.getByText('Wizard')).toBeInTheDocument()
  })
})
