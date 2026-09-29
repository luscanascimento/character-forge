import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="placeholder-page">
      <div className="placeholder-page__rune" aria-hidden="true">
        404
      </div>
      <p>The map fades at the edges</p>
      <h1>That path is uncharted.</h1>
      <span>The page you sought is not recorded in this tome.</span>
      <Link className="button button--primary" to="/">
        Return home
      </Link>
    </section>
  )
}
