import { useQuery } from '@tanstack/react-query'
import { getAppMeta } from './getAppMeta'

export function RulesetStatus() {
  const metadata = useQuery({
    queryKey: ['app-metadata'],
    queryFn: ({ signal }) => getAppMeta(signal),
  })

  if (metadata.isPending) {
    return <span className="ruleset-status">Consulting the archive…</span>
  }

  if (metadata.isError) {
    return (
      <span className="ruleset-status ruleset-status--offline" title="The API is unavailable">
        SRD 5.2.1 · archive offline
      </span>
    )
  }

  return (
    <span className="ruleset-status ruleset-status--ready">
      <span aria-hidden="true" />
      {metadata.data.rulesVersion} · ruleset {metadata.data.ruleset}
    </span>
  )
}
