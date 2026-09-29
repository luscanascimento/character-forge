export function RouteFallback() {
  return (
    <div className="route-fallback" role="status">
      <span className="route-fallback__rune" aria-hidden="true">
        ✦
      </span>
      <span>Opening the tome…</span>
    </div>
  )
}
