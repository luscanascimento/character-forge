import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AttributionsPage() {
  return (
    <section className="legal-page">
      <p>Sources & licenses</p>
      <h1>Attributions</h1>
      <article>
        <h2>System Reference Document 5.2.1</h2>
        <p>
          This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by
          Wizards of the Coast LLC, available at{' '}
          <a href="https://www.dndbeyond.com/srd">https://www.dndbeyond.com/srd</a>. The SRD 5.2.1
          is licensed under the Creative Commons Attribution 4.0 International License, available at{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode">
            https://creativecommons.org/licenses/by/4.0/legalcode
          </a>
          .
        </p>
        <h2>Original hero artwork</h2>
        <p>
          “Hero Forge” was generated specifically for Character Forge with OpenAI image generation
          on September 28, 2026. No third-party artwork was used as input.
        </p>
        <h2>Interface icons</h2>
        <p>
          Icons are provided by Lucide, available under the ISC License. The Character Forge sigil
          is an original inline SVG.
        </p>
      </article>
      <Link className="button button--secondary" to="/">
        <ArrowLeft aria-hidden="true" size={17} />
        Return to the forge
      </Link>
    </section>
  )
}
