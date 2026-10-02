/* oxlint-disable react/only-export-components -- This module intentionally exports the route tree. */
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RouteFallback } from '../components/RouteFallback'

const HomePage = lazy(() => import('../pages/HomePage'))
const CompendiumPage = lazy(() => import('../pages/CompendiumPage'))
const CatalogDetailPage = lazy(() => import('../pages/CatalogDetailPage'))
const ComingSoonPage = lazy(() => import('../pages/ComingSoonPage'))
const CharacterBuilderPage = lazy(() => import('../pages/CharacterBuilderPage'))
const MyCharactersPage = lazy(() => import('../pages/MyCharactersPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))
const AttributionsPage = lazy(() => import('../pages/AttributionsPage'))

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{element}</Suspense>
)

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        path: '/',
        element: withSuspense(<HomePage />),
      },
      {
        path: '/forge',
        element: withSuspense(
          <ComingSoonPage
            eyebrow="The anvil awaits"
            title="Character builder"
            description="The guided, rule-aware forging journey begins in Phase 4. The foundation is ready for it."
          />,
        ),
      },
      {
        path: '/forge/:characterId',
        element: withSuspense(<CharacterBuilderPage />),
      },
      {
        path: '/compendium',
        element: withSuspense(<CompendiumPage />),
      },
      {
        path: '/compendium/:category',
        element: withSuspense(<CompendiumPage />),
      },
      {
        path: '/compendium/:category/:id',
        element: withSuspense(<CatalogDetailPage />),
      },
      {
        path: '/characters',
        element: withSuspense(<MyCharactersPage />),
      },
      {
        path: '/attributions',
        element: withSuspense(<AttributionsPage />),
      },
      {
        path: '*',
        element: withSuspense(<NotFoundPage />),
      },
    ],
  },
])
