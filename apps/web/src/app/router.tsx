/* oxlint-disable react/only-export-components -- This module intentionally exports the route tree. */
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RouteFallback } from '../components/RouteFallback'

const HomePage = lazy(() => import('../pages/HomePage'))
const ComingSoonPage = lazy(() => import('../pages/ComingSoonPage'))
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
        path: '/compendium',
        element: withSuspense(
          <ComingSoonPage
            eyebrow="The archive is sealed"
            title="Compendium"
            description="SRD 5.2.1 classes, species, spells, feats, and equipment arrive in the next phase."
          />,
        ),
      },
      {
        path: '/characters',
        element: withSuspense(
          <ComingSoonPage
            eyebrow="No names in the ledger"
            title="My characters"
            description="Locally saved heroes will appear here when the builder and IndexedDB storage are introduced."
          />,
        ),
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
