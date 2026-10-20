import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RouteErrorContent } from './RouteErrorPage'

describe('RouteErrorContent', () => {
  it('offers safe retry and roster recovery actions', async () => {
    const user = userEvent.setup()
    const retry = vi.fn()

    render(
      <MemoryRouter>
        <RouteErrorContent description="The page failed safely." onRetry={retry} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('The page failed safely.')
    expect(screen.getByRole('link', { name: 'Return to my characters' })).toHaveAttribute(
      'href',
      '/characters',
    )

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
