# Phase 9 polish audit

Checkpoint: 2026-10-20 (America/Sao_Paulo)

## Accessibility

The primary home, roster, builder, compendium, and sheet journeys were reviewed for landmark structure, heading order, accessible names, keyboard reachability, loading/error announcements, and recovery paths.

- Client-side route changes now update the document title, announce the destination, and move focus to the main landmark after navigation.
- The skip link and main navigation remain keyboard reachable at every supported width.
- Existing form errors, pending states, destructive confirmation, and catalog/sheet failures retain explicit status or alert semantics.
- An application-level route boundary now provides retry and safe roster recovery when a route module or render fails unexpectedly.
- The obsolete `/forge` placeholder now enters the working local roster instead of describing already-completed work.

Automated component coverage verifies route focus/title announcements and unexpected-route recovery. A browser-based automated accessibility suite remains appropriate for the Phase 10 E2E toolchain rather than adding a second browser runtime early.

## Motion

Motion remains limited to short entrance/state transitions and decorative forge ambience. The root Motion configuration follows the operating-system preference, while the CSS reduced-motion policy removes animation, transition, smooth scrolling, and hover displacement. No product state depends on animation.

## Performance

The production build now has an executable initial-load budget (`npm run audit:bundle:web`). The checkpoint measurements are:

| Asset group              | Measured |  Budget |
| ------------------------ | -------: | ------: |
| Initial JavaScript, gzip |  109 KiB | 123 KiB |
| Initial CSS, gzip        |    4 KiB |  10 KiB |
| Hero artwork             |  140 KiB | 147 KiB |

The hero image declares intrinsic dimensions, high fetch priority, and asynchronous decoding. Below-fold home content uses `content-visibility` with an intrinsic fallback size. Route-level lazy loading remains in place.

## Responsive layouts

The layout rules were audited at the roadmap targets: 320 px mobile, 640–672 px mobile/tablet, 768 px tablet/laptop boundary, 1024 px laptop, and 1120 px-plus desktop.

- Mobile retains access to Forge, Compendium, and My Characters through a safe-area-aware bottom navigation.
- The eight-step builder progress list scrolls horizontally below 768 px instead of pushing the active form far below the fold.
- Sheet actions and the identity header reflow at narrow widths without fixed-width overflow.
- Compendium controls, roster cards, builder fields, and sheet columns continue to use bounded or `minmax(0, 1fr)` layouts at their existing breakpoints.
- Print remains isolated from screen navigation and preserves the Phase 8 A4 layout.

Phase 10 adds Playwright journey coverage and responsive screenshot artifacts. Pixel-by-pixel regression remains inappropriate until the fallback system fonts are replaced by versioned web fonts that render consistently across runner operating systems.

## Error and empty states

Expected provider, local-storage, malformed-data, missing-character, invalid-character, empty-roster, empty-search, and loading states already had explicit non-destructive messaging and recovery where recovery is possible. Phase 9 added the missing unexpected-route boundary and removed the stale forge placeholder. No error recovery deletes or rewrites a local character.
