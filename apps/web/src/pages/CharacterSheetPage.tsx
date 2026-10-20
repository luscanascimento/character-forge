import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  HeartPulse,
  Pencil,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { formatModifier } from '../features/characters/abilityScores'
import { validateCharacter } from '../features/characters/characterApi'
import type {
  CharacterEvaluation,
  StoredCharacterV1,
} from '../features/characters/characterSchemas'
import {
  CharacterStorage,
  CharacterStorageDataError,
} from '../features/characters/characterStorage'
import { downloadCharacterExport } from '../features/characters/characterTransfer'
import '../styles/sheet.css'

type CharacterSheetRepository = Pick<CharacterStorage, 'get'>

type CharacterSheetPageProps = {
  storage?: CharacterSheetRepository
  validator?: (document: StoredCharacterV1, signal?: AbortSignal) => Promise<CharacterEvaluation>
  printDocument?: () => void
  exportDocument?: (document: StoredCharacterV1) => void
}

const defaultStorage = new CharacterStorage()

const abilityFields = [
  ['strength', 'Strength', 'STR'],
  ['dexterity', 'Dexterity', 'DEX'],
  ['constitution', 'Constitution', 'CON'],
  ['intelligence', 'Intelligence', 'INT'],
  ['wisdom', 'Wisdom', 'WIS'],
  ['charisma', 'Charisma', 'CHA'],
] as const

export default function CharacterSheetPage({
  storage = defaultStorage,
  validator = validateCharacter,
  printDocument = () => window.print(),
  exportDocument = downloadCharacterExport,
}: CharacterSheetPageProps) {
  const { characterId = '' } = useParams()
  const characterQuery = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => storage.get(characterId),
    retry: false,
  })
  const document = characterQuery.data
  const evaluationQuery = useQuery({
    queryKey: ['character-sheet-evaluation', characterId, document?.updatedAt],
    queryFn: ({ signal }) => validator(document!, signal),
    enabled: document !== null && document !== undefined,
    retry: false,
  })

  if (characterQuery.isPending) {
    return <SheetState title="Opening the character sheet…" pending />
  }

  if (characterQuery.isError) {
    const malformed = characterQuery.error instanceof CharacterStorageDataError
    return (
      <SheetState
        title={malformed ? 'This saved character is malformed' : 'The local ledger is unavailable'}
        description="Nothing was changed. Return to your roster or try reading this character again."
        onRetry={() => void characterQuery.refetch()}
      />
    )
  }

  if (!document) {
    return (
      <SheetState
        title="Character not found"
        description="This character is not stored in this browser. It may have been deleted or created in another browser."
      />
    )
  }

  if (evaluationQuery.isPending) {
    return <SheetState title="Preparing trusted character values…" pending />
  }

  if (evaluationQuery.isError || !evaluationQuery.data) {
    return (
      <SheetState
        title="The character could not be validated"
        description="The local draft is unchanged. Try the rules service again when it is available."
        onRetry={() => void evaluationQuery.refetch()}
      />
    )
  }

  const evaluation = evaluationQuery.data
  if (evaluation.validation.isValid && !evaluation.derived) {
    return (
      <SheetState
        title="Trusted character values are unavailable"
        description="The local draft is unchanged. Ask the rules service to validate it again."
        onRetry={() => void evaluationQuery.refetch()}
      />
    )
  }

  if (!evaluation.validation.isValid) {
    return <InvalidSheet document={document} evaluation={evaluation} />
  }

  return (
    <div className="sheet-page">
      <nav className="sheet-toolbar" aria-label="Character sheet actions">
        <Link to="/characters">
          <ArrowLeft aria-hidden="true" size={17} /> Back to roster
        </Link>
        <div>
          <Link to={`/forge/${document.id}`}>
            <Pencil aria-hidden="true" size={16} /> Edit
          </Link>
          <button type="button" onClick={() => exportDocument(document)}>
            <Download aria-hidden="true" size={16} /> Export JSON
          </button>
          <button type="button" onClick={printDocument}>
            <Printer aria-hidden="true" size={16} /> Print / Save PDF
          </button>
        </div>
      </nav>
      <CharacterSheet document={document} evaluation={evaluation} />
    </div>
  )
}

function CharacterSheet({
  document,
  evaluation,
}: {
  document: StoredCharacterV1
  evaluation: CharacterEvaluation
}) {
  const derived = evaluation.derived!
  const progression = document.character.classProgressions[0]
  const expertise = document.character.featureChoices
    .filter((choice) => choice.requirementId.includes('expertise'))
    .flatMap((choice) => choice.selections)
  const styles = document.character.featureChoices.filter((choice) =>
    choice.requirementId.includes('fighting-style'),
  )

  return (
    <article className="character-sheet" aria-labelledby="character-sheet-name">
      <header className="sheet-header">
        <div className="sheet-header__mark" aria-hidden="true">
          CF
        </div>
        <div>
          <p>Character Forge · {document.rulesVersion}</p>
          <h1 id="character-sheet-name">{document.character.name}</h1>
          <span>
            Level {progression?.level} {document.character.species?.name}{' '}
            {progression?.subclass?.name ?? progression?.class?.name}
          </span>
        </div>
        <ShieldCheck aria-label="Valid character" size={34} />
      </header>

      <section className="sheet-stat-band" aria-label="Core statistics">
        <SheetStat icon={<ShieldCheck />} label="Armor class" value={derived.armorClass} />
        <SheetStat
          icon={<HeartPulse />}
          label="Hit points"
          value={derived.hitPointMaximum ?? '—'}
        />
        <SheetStat
          icon={<Sparkles />}
          label="Proficiency"
          value={formatModifier(derived.proficiencyBonus)}
        />
        <SheetStat
          icon={<span>d{derived.hitDie}</span>}
          label="Hit die"
          value={`d${derived.hitDie}`}
        />
        <SheetStat icon={<span>↟</span>} label="Speed" value={`${derived.walkingSpeed} ft.`} />
      </section>

      <div className="sheet-columns">
        <div>
          <SheetSection title="Ability scores">
            <dl className="sheet-abilities">
              {abilityFields.map(([key, name, abbreviation]) => (
                <div key={key}>
                  <dt title={name}>{abbreviation}</dt>
                  <dd>{derived.effectiveAbilities[key]}</dd>
                  <span>{formatModifier(derived.abilityModifiers[key])}</span>
                  {derived.baseAbilities[key] !== derived.effectiveAbilities[key] && (
                    <small>base {derived.baseAbilities[key]}</small>
                  )}
                </div>
              ))}
            </dl>
          </SheetSection>

          <SheetSection title="Identity">
            <dl className="sheet-details">
              <Detail label="Species" value={document.character.species?.name} />
              <Detail label="Background" value={document.character.background?.name} />
              <Detail label="Class" value={progression?.class?.name} />
              <Detail label="Subclass" value={progression?.subclass?.name ?? '—'} />
              {styles.length > 0 && (
                <Detail
                  label="Fighting style"
                  value={styles
                    .flatMap((choice) => choice.selections)
                    .map(named)
                    .join(', ')}
                />
              )}
              {expertise.length > 0 && (
                <Detail label="Expertise" value={expertise.map(named).join(', ')} />
              )}
              {document.character.feats.length > 0 && (
                <Detail
                  label="Feats"
                  value={document.character.feats.map((choice) => choice.feat.name).join(', ')}
                />
              )}
            </dl>
          </SheetSection>

          <SheetSection title="Proficiencies">
            <ul className="sheet-list">
              {derived.grantedProficiencies.map((grant) => (
                <li key={grant.proficiency.id}>
                  <strong>{grant.proficiency.name}</strong>
                  <span>{grant.sources.map((source) => source.selection.name).join(', ')}</span>
                </li>
              ))}
            </ul>
          </SheetSection>
        </div>

        <div>
          {derived.spellcasting && (
            <SheetSection title="Spellcasting">
              <dl className="sheet-mini-stats">
                <Detail label="Ability" value={derived.spellcasting.ability.name} />
                <Detail label="Save DC" value={String(derived.spellcasting.spellSaveDc)} />
                <Detail
                  label="Attack"
                  value={formatModifier(derived.spellcasting.spellAttackModifier)}
                />
              </dl>
              <SpellList label="Cantrips" spells={document.character.spells.cantrips} />
              <SpellList
                label="Prepared spells"
                spells={document.character.spells.preparedSpells}
              />
              {derived.spellcasting.slots.length > 0 && (
                <p className="sheet-slots">
                  <strong>Spell slots</strong>{' '}
                  {derived.spellcasting.slots
                    .map((slot) => `L${slot.spellLevel} × ${slot.count}`)
                    .join(' · ')}
                </p>
              )}
            </SheetSection>
          )}

          <SheetSection title="Weapons & attacks">
            {derived.weaponAttacks.length > 0 ? (
              <ul className="sheet-attacks">
                {derived.weaponAttacks.map((attack) => (
                  <li key={attack.weapon.id}>
                    <strong>{attack.weapon.name}</strong>
                    <span>{formatModifier(attack.attackModifier)} to hit</span>
                    <span>
                      {attack.damage.dice} {formatModifier(attack.damageModifier)}{' '}
                      {attack.damage.type.name}
                    </span>
                    <small>
                      {attack.isProficient ? 'Proficient' : 'Not proficient'}
                      {attack.mastery ? ` · ${attack.mastery.name} mastery` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sheet-empty">No configured weapon attacks.</p>
            )}
          </SheetSection>

          <SheetSection title="Equipment">
            {document.character.equipment.items.length > 0 ? (
              <ul className="sheet-list sheet-list--compact">
                {document.character.equipment.items.map((selection) => (
                  <li key={selection.item.id}>
                    <strong>
                      {selection.item.name} × {selection.quantity}
                    </strong>
                    <span>{selection.equipped ? 'Equipped' : 'Owned'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sheet-empty">No equipment recorded.</p>
            )}
          </SheetSection>

          {(derived.hasStealthDisadvantage || derived.weaponMasteries.length > 0) && (
            <SheetSection title="Active rules">
              <ul className="sheet-notes">
                {derived.hasStealthDisadvantage && <li>Disadvantage on Stealth checks</li>}
                {derived.weaponMasteries.map((mastery) => (
                  <li key={mastery.weapon.id}>
                    {mastery.weapon.name}: {mastery.mastery.name} mastery
                  </li>
                ))}
              </ul>
            </SheetSection>
          )}
        </div>
      </div>

      <footer className="sheet-footer">
        Canonically validated against {document.rulesVersion}. Generated locally by Character Forge.
      </footer>
    </article>
  )
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sheet-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function SheetStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <span aria-hidden="true">{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}

function SpellList({
  label,
  spells,
}: {
  label: string
  spells: Array<{ id: string; name: string }>
}) {
  if (spells.length === 0) return null
  return (
    <div className="sheet-spells">
      <h3>{label}</h3>
      <p>{spells.map(named).join(', ')}</p>
    </div>
  )
}

function InvalidSheet({
  document,
  evaluation,
}: {
  document: StoredCharacterV1
  evaluation: CharacterEvaluation
}) {
  return (
    <div className="sheet-page">
      <nav className="sheet-toolbar" aria-label="Character sheet actions">
        <Link to="/characters">
          <ArrowLeft aria-hidden="true" size={17} /> Back to roster
        </Link>
      </nav>
      <div className="sheet-state sheet-state--error" role="alert">
        <AlertTriangle aria-hidden="true" size={34} />
        <h1>This character still needs attention</h1>
        <p>A printable sheet is available only after canonical validation succeeds.</p>
        <ul>
          {evaluation.validation.violations.map((violation, index) => (
            <li key={`${violation.code}-${violation.source}-${index}`}>{violation.message}</li>
          ))}
        </ul>
        <Link className="button button--primary" to={`/forge/${document.id}`}>
          <Pencil aria-hidden="true" size={17} /> Return to the builder
        </Link>
      </div>
    </div>
  )
}

function SheetState({
  title,
  description,
  pending = false,
  onRetry,
}: {
  title: string
  description?: string
  pending?: boolean
  onRetry?: () => void
}) {
  return (
    <div className="sheet-page">
      <nav className="sheet-toolbar" aria-label="Character sheet actions">
        <Link to="/characters">
          <ArrowLeft aria-hidden="true" size={17} /> Back to roster
        </Link>
      </nav>
      <div className="sheet-state" role={pending ? 'status' : 'alert'}>
        {pending ? (
          <span className="sheet-state__rune" aria-hidden="true">
            ✦
          </span>
        ) : (
          <AlertTriangle aria-hidden="true" size={34} />
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {onRetry && (
          <button className="button button--secondary" type="button" onClick={onRetry}>
            <RefreshCw aria-hidden="true" size={17} /> Try again
          </button>
        )}
      </div>
    </div>
  )
}

function named(item: { name: string }): string {
  return item.name
}
