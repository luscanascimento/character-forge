import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { catalogCategorySchema, categoryDetails } from '../features/catalog/catalog'
import { getCatalogItem } from '../features/catalog/catalogApi'
import '../styles/catalog.css'

export default function CatalogDetailPage() {
  const { category: categoryParam, id } = useParams()
  const parsedCategory = catalogCategorySchema.safeParse(categoryParam)
  const category = parsedCategory.success ? parsedCategory.data : undefined
  const query = useQuery({
    queryKey: ['catalog-item', category, id],
    queryFn: ({ signal }) => getCatalogItem(category!, id!, signal),
    enabled: Boolean(category && id),
  })

  if (!category || !id) {
    return <DetailState title="This path leads beyond the archive." />
  }

  if (query.isPending) {
    return <DetailState title="Unsealing the archive entry…" busy />
  }

  if (query.isError) {
    return (
      <DetailState
        title="This entry could not be recovered."
        action={<button onClick={() => void query.refetch()}>Try again</button>}
      />
    )
  }

  const item = query.data
  const details = categoryDetails[category]

  return (
    <article className="catalog-detail">
      <Link className="catalog-detail__back" to={`/compendium/${category}`}>
        <ArrowLeft aria-hidden="true" size={17} /> Back to {details.label}
      </Link>

      <header className="catalog-detail__header">
        <span aria-hidden="true">{details.sigil}</span>
        <div>
          <p>
            {details.singular} · {item.source.rulesVersion}
          </p>
          <h1>{item.name}</h1>
        </div>
      </header>

      {item.attributes.length > 0 && (
        <dl className="catalog-detail__attributes">
          {item.attributes.map((attribute) => (
            <div key={attribute.label}>
              <dt>{attribute.label}</dt>
              <dd>{attribute.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="catalog-detail__body">
        {item.description.length > 0 ? (
          <section aria-labelledby="entry-description">
            <h2 id="entry-description">Archive notes</h2>
            {item.description.map((paragraph, index) => (
              <RichText key={index} text={paragraph} />
            ))}
          </section>
        ) : (
          <section className="catalog-detail__quiet" aria-label="Description unavailable">
            <p>No narrative text is supplied for this entry by the SRD API.</p>
          </section>
        )}

        {item.textSections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <RichText key={index} text={paragraph} />
            ))}
          </section>
        ))}

        {item.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <ul className="catalog-detail__references">
              {section.entries.map((entry) => (
                <li key={entry.id}>
                  <span>{entry.name}</span>
                  {entry.note && <small>{entry.note}</small>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="catalog-detail__source">
        Content from {item.source.provider} · ruleset {item.source.ruleset} ·{' '}
        {item.source.rulesVersion}
      </footer>
    </article>
  )
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      )}
    </p>
  )
}

function DetailState({
  title,
  busy,
  action,
}: {
  title: string
  busy?: boolean
  action?: ReactNode
}) {
  return (
    <div className="detail-state" aria-busy={busy}>
      <span aria-hidden="true">✧</span>
      <h1>{title}</h1>
      {action}
      <Link to="/compendium">Return to the compendium</Link>
    </div>
  )
}
