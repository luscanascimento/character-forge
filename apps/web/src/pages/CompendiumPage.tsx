import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  catalogCategories,
  catalogCategorySchema,
  categoryDetails,
  spellClasses,
  spellSchools,
  type CatalogCategory,
  type CatalogFilters,
} from '../features/catalog/catalog'
import { getCatalogPage } from '../features/catalog/catalogApi'
import '../styles/catalog.css'

function selectedCategory(value: string | undefined): CatalogCategory {
  const parsed = catalogCategorySchema.safeParse(value)
  return parsed.success ? parsed.data : 'classes'
}

export default function CompendiumPage() {
  const { category: routeCategory } = useParams()
  const category = selectedCategory(routeCategory)
  const details = categoryDetails[category]
  const [searchParams, setSearchParams] = useSearchParams()
  const reduceMotion = useReducedMotion()

  const filters: CatalogFilters = {
    search: searchParams.get('search') || undefined,
    page: positiveNumber(searchParams.get('page')) ?? 1,
    level: nullableNumber(searchParams.get('level')),
    school: searchParams.get('school') || undefined,
    characterClass: searchParams.get('class') || undefined,
    sort: searchParams.get('sort') === 'level' ? 'level' : 'name',
  }

  const catalogQuery = useQuery({
    queryKey: ['catalog', category, filters],
    queryFn: ({ signal }) => getCatalogPage(category, filters, signal),
  })

  function updateFilter(key: string, value?: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const search = form.get('search')
    updateFilter('search', typeof search === 'string' ? search.trim() || undefined : undefined)
  }

  return (
    <div className="catalog-page">
      <header className="catalog-hero">
        <p>The adventurer&apos;s archive</p>
        <h1>Compendium</h1>
        <span>Explore the rules and lore available in the open SRD 5.2.1 collection.</span>
      </header>

      <nav className="catalog-tabs" aria-label="Compendium categories">
        {catalogCategories.map((item) => (
          <Link
            className={item === category ? 'catalog-tab catalog-tab--active' : 'catalog-tab'}
            key={item}
            to={`/compendium/${item}`}
            aria-current={item === category ? 'page' : undefined}
          >
            <span aria-hidden="true">{categoryDetails[item].sigil}</span>
            {categoryDetails[item].label}
          </Link>
        ))}
      </nav>

      <section className="catalog-workspace" aria-labelledby="catalog-heading">
        <div className="catalog-heading">
          <div>
            <p>{details.singular} archive</p>
            <h2 id="catalog-heading">{details.label}</h2>
            <span>{details.description}</span>
          </div>
          {catalogQuery.data && (
            <strong aria-live="polite">
              {catalogQuery.data.total} {catalogQuery.data.total === 1 ? 'entry' : 'entries'}
            </strong>
          )}
        </div>

        <form className="catalog-tools" onSubmit={submitSearch} role="search">
          <label className="catalog-search">
            <span className="sr-only">Search {details.label}</span>
            <Search aria-hidden="true" size={18} />
            <input
              key={`${category}-${filters.search ?? ''}`}
              name="search"
              defaultValue={filters.search ?? ''}
              placeholder={`Search ${details.label.toLowerCase()}...`}
              maxLength={80}
            />
          </label>
          <button className="catalog-search-button" type="submit">
            Search
          </button>

          {category === 'spells' && (
            <div className="spell-filters" aria-label="Spell filters">
              <SlidersHorizontal aria-hidden="true" size={17} />
              <label>
                <span className="sr-only">Spell level</span>
                <select
                  value={filters.level ?? ''}
                  onChange={(event) => updateFilter('level', event.target.value)}
                >
                  <option value="">All levels</option>
                  <option value="0">Cantrips</option>
                  {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
                    <option key={level} value={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Magic school</span>
                <select
                  value={filters.school ?? ''}
                  onChange={(event) => updateFilter('school', event.target.value)}
                >
                  <option value="">All schools</option>
                  {spellSchools.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Character class</span>
                <select
                  value={filters.characterClass ?? ''}
                  onChange={(event) => updateFilter('class', event.target.value)}
                >
                  <option value="">All classes</option>
                  {spellClasses.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Sort spells</span>
                <select
                  value={filters.sort}
                  onChange={(event) => updateFilter('sort', event.target.value)}
                >
                  <option value="name">Name</option>
                  <option value="level">Level</option>
                </select>
              </label>
            </div>
          )}
        </form>

        {catalogQuery.isPending && <CatalogLoading />}
        {catalogQuery.isError && (
          <CatalogState
            rune="⌁"
            title="The archive doors are sealed"
            copy="The rules source is temporarily unavailable. Your place is safe — try opening it again."
            action={<button onClick={() => void catalogQuery.refetch()}>Try again</button>}
          />
        )}
        {catalogQuery.data?.items.length === 0 && (
          <CatalogState
            rune="∅"
            title="No entries answer that name"
            copy="Clear a filter or try a different search term."
          />
        )}

        <AnimatePresence mode="wait">
          {catalogQuery.data && catalogQuery.data.items.length > 0 && (
            <motion.div
              className="catalog-grid"
              key={`${category}-${JSON.stringify(filters)}`}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {catalogQuery.data.items.map((item, index) => (
                <article className="catalog-card" key={item.id}>
                  <div className="catalog-card__mark" aria-hidden="true">
                    <span>{details.sigil}</span>
                    <small>
                      {String(
                        index + 1 + (catalogQuery.data.page - 1) * catalogQuery.data.pageSize,
                      ).padStart(2, '0')}
                    </small>
                  </div>
                  <div>
                    <p>
                      {item.level === 0
                        ? 'Cantrip'
                        : item.level
                          ? `Level ${item.level}`
                          : details.singular}
                    </p>
                    <h3>{item.name}</h3>
                    <span>Open the archive entry</span>
                  </div>
                  <Link
                    to={`/compendium/${category}/${item.id}`}
                    aria-label={`Explore ${item.name}`}
                  />
                </article>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {catalogQuery.data && catalogQuery.data.totalPages > 1 && (
          <nav className="catalog-pagination" aria-label="Catalog pages">
            <button
              disabled={catalogQuery.data.page <= 1}
              onClick={() => updateFilter('page', String(catalogQuery.data.page - 1))}
            >
              <ChevronLeft aria-hidden="true" size={17} /> Previous
            </button>
            <span>
              Page {catalogQuery.data.page} of {catalogQuery.data.totalPages}
            </span>
            <button
              disabled={catalogQuery.data.page >= catalogQuery.data.totalPages}
              onClick={() => updateFilter('page', String(catalogQuery.data.page + 1))}
            >
              Next <ChevronRight aria-hidden="true" size={17} />
            </button>
          </nav>
        )}

        {catalogQuery.data && (
          <p className="catalog-source">
            {catalogQuery.data.source.rulesVersion} · {catalogQuery.data.source.provider}
          </p>
        )}
      </section>
    </div>
  )
}

function CatalogLoading() {
  return (
    <div className="catalog-grid" aria-label="Opening the archive" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="catalog-card catalog-card--loading" key={index} />
      ))}
    </div>
  )
}

function CatalogState({
  rune,
  title,
  copy,
  action,
}: {
  rune: string
  title: string
  copy: string
  action?: ReactNode
}) {
  return (
    <div className="catalog-state">
      <span aria-hidden="true">{rune}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  )
}

function positiveNumber(value: string | null) {
  if (!value) return undefined
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : undefined
}

function nullableNumber(value: string | null) {
  if (value === null || value === '') return undefined
  const number = Number(value)
  return Number.isInteger(number) ? number : undefined
}
