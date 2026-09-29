import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

type ComingSoonPageProps = {
  eyebrow: string
  title: string
  description: string
}

export default function ComingSoonPage({ eyebrow, title, description }: ComingSoonPageProps) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-page__rune" aria-hidden="true">
        ✦
      </div>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
      <Link className="button button--secondary" to="/">
        <ArrowLeft aria-hidden="true" size={17} />
        Return to the forge
      </Link>
    </section>
  )
}
