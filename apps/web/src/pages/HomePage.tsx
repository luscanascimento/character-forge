import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, BookOpen, ScrollText, Shield, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RulesetStatus } from '../features/meta/RulesetStatus'

const paths = [
  {
    to: '/forge',
    icon: Sparkles,
    kicker: 'Begin a legend',
    title: 'Forge a character',
    description: 'A guided journey from first spark to a complete adventurer.',
  },
  {
    to: '/compendium',
    icon: BookOpen,
    kicker: 'Consult the archive',
    title: 'Open compendium',
    description: 'Explore the legal 2024 SRD rules without losing your place.',
  },
  {
    to: '/characters',
    icon: ScrollText,
    kicker: 'Return to the guild',
    title: 'My characters',
    description: 'Your heroes stay on your device, ready for the next session.',
  },
] as const

export default function HomePage() {
  const reduceMotion = useReducedMotion()

  const reveal = {
    initial: reduceMotion ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
  }

  return (
    <>
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art__embers" />
        </div>
        <div className="hero-vignette" aria-hidden="true" />
        <motion.div
          className="hero-content"
          initial={reveal.initial}
          animate={reveal.animate}
          transition={{ duration: reduceMotion ? 0 : 0.55, ease: 'easeOut' }}
        >
          <div className="hero-eyebrow">
            <span aria-hidden="true">✦</span>A rule-aware fifth edition character builder
          </div>
          <h1 id="hero-title">
            Forge a legend.
            <span>Roll the story.</span>
          </h1>
          <p className="hero-copy">
            Shape an adventurer through meaningful choices, clear rules, and a character sheet
            worthy of the tale ahead.
          </p>
          <div className="hero-actions">
            <Link className="button button--primary" to="/forge">
              Forge a character
              <ArrowRight aria-hidden="true" size={18} strokeWidth={1.8} />
            </Link>
            <Link className="button button--secondary" to="/compendium">
              Open compendium
            </Link>
          </div>
          <div className="hero-meta">
            <RulesetStatus />
            <span className="hero-meta__privacy">
              <Shield aria-hidden="true" size={15} />
              No account. Your heroes remain local.
            </span>
          </div>
        </motion.div>
        <div className="hero-scroll-cue" aria-hidden="true">
          <span />
          Choose your path
        </div>
      </section>

      <section className="path-section" aria-labelledby="path-heading">
        <div className="section-heading">
          <p>The guild doors are open</p>
          <h2 id="path-heading">Every legend starts somewhere.</h2>
        </div>
        <div className="path-grid">
          {paths.map((path, index) => {
            const Icon = path.icon

            return (
              <motion.article
                className="path-card"
                key={path.to}
                initial={reduceMotion ? false : { y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ delay: reduceMotion ? 0 : index * 0.08, duration: 0.4 }}
              >
                <div className="path-card__sigil" aria-hidden="true">
                  <Icon size={25} strokeWidth={1.4} />
                </div>
                <p>{path.kicker}</p>
                <h3>{path.title}</h3>
                <span>{path.description}</span>
                <Link to={path.to} aria-label={`${path.title}: ${path.description}`}>
                  Enter
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </motion.article>
            )
          })}
        </div>
      </section>

      <section className="oath-section" aria-label="Character Forge principles">
        <div className="oath-rule" aria-hidden="true">
          <span>✦</span>
        </div>
        <blockquote>
          “Rules should guide the adventure, never get between you and the story.”
        </blockquote>
        <p>Built for the table. Kept on your device. Grounded in SRD 5.2.1.</p>
      </section>

      <footer className="site-footer">
        <div>
          <span className="site-footer__brand">Character Forge</span>
          <span>Made for adventurers, one deliberate choice at a time.</span>
        </div>
        <p>
          This work includes material from the System Reference Document 5.2.1 by Wizards of the
          Coast LLC, licensed under CC BY 4.0. See <Link to="/attributions">attributions</Link>.
        </p>
      </footer>
    </>
  )
}
