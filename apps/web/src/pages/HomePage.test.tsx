import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'

const renderHomePage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HomePage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('offers the three primary journeys', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

    renderHomePage()

    expect(screen.getAllByRole('link', { name: /forge a character/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /open compendium/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /my characters:/i })).toHaveAttribute(
      'href',
      '/characters',
    )
  })

  it('shows the ruleset reported by the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'Character Forge',
          ruleset: '2024',
          rulesVersion: 'SRD-5.2.1',
          status: 'ready',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    renderHomePage()

    expect(await screen.findByText(/SRD-5\.2\.1 · ruleset 2024/i)).toBeInTheDocument()
  })
})
