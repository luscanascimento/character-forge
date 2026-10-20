import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

export default function RouteErrorPage() {
  const error = useRouteError()
  const description = isRouteErrorResponse(error)
    ? `The page returned ${error.status}. Your local characters were not changed.`
    : 'The page could not be opened. Your local characters were not changed.'

  return <RouteErrorContent description={description} />
}

export function RouteErrorContent({
  description,
  onRetry = () => window.location.reload(),
}: {
  description: string
  onRetry?: () => void
}) {
  return (
    <main className="placeholder-page" id="main-content" role="alert">
      <div className="placeholder-page__rune" aria-hidden="true">
        <AlertTriangle size={26} />
      </div>
      <p>The path was interrupted</p>
      <h1>This page could not be opened.</h1>
      <span>{description}</span>
      <div className="route-error-actions">
        <button className="button button--primary" type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" size={17} /> Try again
        </button>
        <Link className="button button--secondary" to="/characters">
          Return to my characters
        </Link>
      </div>
    </main>
  )
}
