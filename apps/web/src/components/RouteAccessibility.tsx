import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getRouteAnnouncement, getRouteTitle } from './routeTitles'

export function RouteAccessibility() {
  const { pathname } = useLocation()
  const initialPath = useRef(pathname)

  useEffect(() => {
    document.title = getRouteTitle(pathname)

    if (pathname !== initialPath.current) {
      document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true })
    }
  }, [pathname])

  return (
    <span className="sr-only" aria-live="polite" aria-atomic="true">
      {getRouteAnnouncement(pathname)}
    </span>
  )
}
