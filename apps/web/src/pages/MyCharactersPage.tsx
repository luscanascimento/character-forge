import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Copy,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CharacterStorage,
  CharacterStorageDataError,
} from '../features/characters/characterStorage'
import {
  createStoredCharacterDraft,
  duplicateStoredCharacter,
  type StoredCharacterV1,
} from '../features/characters/characterSchemas'
import '../styles/characters.css'

type CharacterRepository = Pick<CharacterStorage, 'list' | 'save' | 'delete'>

type MyCharactersPageProps = {
  storage?: CharacterRepository
  createDraft?: () => StoredCharacterV1
  duplicateDraft?: (source: StoredCharacterV1) => StoredCharacterV1
}

const defaultStorage = new CharacterStorage()

export default function MyCharactersPage({
  storage = defaultStorage,
  createDraft = createStoredCharacterDraft,
  duplicateDraft = duplicateStoredCharacter,
}: MyCharactersPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pendingDeletion, setPendingDeletion] = useState<StoredCharacterV1 | null>(null)
  const charactersQuery = useQuery({
    queryKey: ['characters'],
    queryFn: () => storage.list(),
    retry: false,
  })
  const createMutation = useMutation({
    mutationFn: () => storage.save(createDraft()),
    onSuccess: (document) => {
      queryClient.setQueryData<StoredCharacterV1[]>(['characters'], (characters = []) => [
        document,
        ...characters,
      ])
      navigate(`/forge/${document.id}`)
    },
  })
  const duplicateMutation = useMutation({
    mutationFn: (source: StoredCharacterV1) => storage.save(duplicateDraft(source)),
    onSuccess: (document) => {
      queryClient.setQueryData<StoredCharacterV1[]>(['characters'], (characters = []) => [
        document,
        ...characters,
      ])
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (document: StoredCharacterV1) => storage.delete(document.id),
    onSuccess: (_, document) => {
      queryClient.setQueryData<StoredCharacterV1[]>(['characters'], (characters = []) =>
        characters.filter((character) => character.id !== document.id),
      )
      setPendingDeletion(null)
    },
  })

  function requestDeletion(document: StoredCharacterV1) {
    deleteMutation.reset()
    setPendingDeletion(document)
  }

  function cancelDeletion() {
    if (deleteMutation.isPending) return
    deleteMutation.reset()
    setPendingDeletion(null)
  }

  return (
    <div className="characters-page">
      <header className="characters-hero">
        <div>
          <p>Your local roster</p>
          <h1>My characters</h1>
          <span>Heroes saved here stay in this browser, under your control.</span>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Plus aria-hidden="true" size={18} />
          {createMutation.isPending ? 'Opening the forge…' : 'Forge a character'}
        </button>
      </header>

      <section className="characters-workspace" aria-labelledby="character-roster-heading">
        <div className="characters-heading">
          <div>
            <p>The ledger</p>
            <h2 id="character-roster-heading">Saved heroes</h2>
          </div>
          {charactersQuery.data && (
            <strong aria-live="polite">
              {charactersQuery.data.length}{' '}
              {charactersQuery.data.length === 1 ? 'character' : 'characters'}
            </strong>
          )}
        </div>

        {createMutation.isError && (
          <div className="characters-inline-error" role="alert">
            <AlertTriangle aria-hidden="true" size={18} />
            The draft could not be saved. Your existing characters were not changed.
          </div>
        )}
        {duplicateMutation.isError && (
          <div className="characters-inline-error" role="alert">
            <AlertTriangle aria-hidden="true" size={18} />
            {displayCharacterName(duplicateMutation.variables)} could not be duplicated. The source
            character was not changed.
          </div>
        )}

        {charactersQuery.isPending && <CharacterLoadingState />}
        {charactersQuery.isError && (
          <CharacterErrorState
            error={charactersQuery.error}
            onRetry={() => void charactersQuery.refetch()}
          />
        )}
        {charactersQuery.isSuccess && charactersQuery.data.length === 0 && (
          <CharacterEmptyState onCreate={() => createMutation.mutate()} />
        )}
        {charactersQuery.isSuccess && charactersQuery.data.length > 0 && (
          <ol className="character-grid" aria-label="Characters ordered by most recently updated">
            {charactersQuery.data.map((document) => (
              <li key={document.id}>
                <CharacterCard
                  document={document}
                  duplicating={
                    duplicateMutation.isPending && duplicateMutation.variables.id === document.id
                  }
                  onDuplicate={() => {
                    duplicateMutation.reset()
                    duplicateMutation.mutate(document)
                  }}
                  onDelete={() => requestDeletion(document)}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      {pendingDeletion && (
        <DeleteCharacterDialog
          document={pendingDeletion}
          pending={deleteMutation.isPending}
          failed={deleteMutation.isError}
          onCancel={cancelDeletion}
          onConfirm={() => deleteMutation.mutate(pendingDeletion)}
        />
      )}
    </div>
  )
}

function CharacterLoadingState() {
  return (
    <div className="characters-state" role="status">
      <span className="characters-state__rune" aria-hidden="true">
        ✦
      </span>
      <h3>Opening the ledger…</h3>
      <p>Reading the characters saved in this browser.</p>
    </div>
  )
}

function CharacterEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="characters-state">
      <BookOpen aria-hidden="true" size={34} />
      <h3>Your ledger is empty</h3>
      <p>Begin with a blank draft. It will be stored only in this browser.</p>
      <button className="button button--secondary" type="button" onClick={onCreate}>
        <Plus aria-hidden="true" size={17} />
        Create first character
      </button>
    </div>
  )
}

function CharacterErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const malformed = error instanceof CharacterStorageDataError

  return (
    <div className="characters-state characters-state--error" role="alert">
      <AlertTriangle aria-hidden="true" size={34} />
      <h3>{malformed ? 'A saved character needs attention' : 'The local ledger is unavailable'}</h3>
      <p>
        {malformed
          ? 'One or more records could not be read. Nothing was deleted or replaced.'
          : 'This browser could not open local character storage. Check privacy settings or try again.'}
      </p>
      <button className="button button--secondary" type="button" onClick={onRetry}>
        <RefreshCw aria-hidden="true" size={17} />
        Try again
      </button>
    </div>
  )
}

function CharacterCard({
  document,
  duplicating,
  onDuplicate,
  onDelete,
}: {
  document: StoredCharacterV1
  duplicating: boolean
  onDuplicate: () => void
  onDelete: () => void
}) {
  const progression = document.character.classProgressions[0]
  const characterClass = progression?.class?.name
  const identity = [document.character.species?.name, characterClass].filter(Boolean).join(' · ')
  const name = displayCharacterName(document)

  return (
    <article className="character-card">
      <div className="character-card__sigil" aria-hidden="true">
        <Shield size={22} />
      </div>
      <div className="character-card__body">
        <p>{identity || 'New draft'}</p>
        <h3>{name}</h3>
        <span>
          {characterClass && progression
            ? `Level ${progression.level}`
            : 'Choices not yet complete'}
          {' · '}
          Updated {formatUpdatedAt(document.updatedAt)}
        </span>
      </div>
      <div className="character-card__actions">
        <Link to={`/forge/${document.id}`} aria-label={`Continue ${name}`}>
          Continue <ArrowRight aria-hidden="true" size={16} />
        </Link>
        <button
          type="button"
          aria-label={`Duplicate ${name}`}
          onClick={onDuplicate}
          disabled={duplicating}
        >
          <Copy aria-hidden="true" size={15} />
          {duplicating ? 'Duplicating…' : 'Duplicate'}
        </button>
        <button
          className="character-card__delete"
          type="button"
          aria-label={`Delete ${name}`}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" size={15} />
          Delete
        </button>
      </div>
    </article>
  )
}

function DeleteCharacterDialog({
  document,
  pending,
  failed,
  onCancel,
  onConfirm,
}: {
  document: StoredCharacterV1
  pending: boolean
  failed: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const name = displayCharacterName(document)

  return (
    <div className="character-dialog-backdrop">
      <section
        className="character-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-character-heading"
        aria-describedby="delete-character-description"
      >
        <AlertTriangle aria-hidden="true" size={30} />
        <h2 id="delete-character-heading">Delete {name}?</h2>
        <p id="delete-character-description">
          This permanently removes the character from this browser. This action cannot be undone.
        </p>
        {failed && (
          <div className="characters-inline-error" role="alert">
            <AlertTriangle aria-hidden="true" size={18} />
            The character could not be deleted and remains in your roster.
          </div>
        )}
        <div className="character-dialog__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onCancel}
            disabled={pending}
            autoFocus
          >
            Keep character
          </button>
          <button
            className="button character-dialog__confirm"
            type="button"
            onClick={onConfirm}
            disabled={pending}
          >
            <Trash2 aria-hidden="true" size={16} />
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </section>
    </div>
  )
}

function displayCharacterName(document: StoredCharacterV1 | undefined): string {
  return document?.character.name.trim() || 'Untitled character'
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(new Date(value))
}
