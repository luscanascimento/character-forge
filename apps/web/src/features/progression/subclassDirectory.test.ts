import { describe, expect, it } from 'vitest'
import { getSubclassDirectory, subclassDirectoryClassIds } from './subclassDirectory'

const srdSubclassByClass = {
  barbarian: 'path-of-the-berserker',
  bard: 'college-of-lore',
  cleric: 'life-domain',
  druid: 'circle-of-the-land',
  fighter: 'champion',
  monk: 'warrior-of-the-open-hand',
  paladin: 'oath-of-devotion',
  ranger: 'hunter',
  rogue: 'thief',
  sorcerer: 'draconic-sorcery',
  warlock: 'fiend-patron',
  wizard: 'evoker',
} as const

describe('2024 subclass directory', () => {
  it('lists four subclasses for all twelve classes', () => {
    expect(subclassDirectoryClassIds).toHaveLength(12)

    for (const classId of subclassDirectoryClassIds) {
      expect(getSubclassDirectory(classId)).toHaveLength(4)
    }
  })

  it('includes the SRD-backed subclass for every class', () => {
    for (const [classId, subclassId] of Object.entries(srdSubclassByClass)) {
      expect(getSubclassDirectory(classId).map((subclass) => subclass.id)).toContain(subclassId)
    }
  })

  it('uses unique stable ids', () => {
    const ids = subclassDirectoryClassIds.flatMap((classId) =>
      getSubclassDirectory(classId).map((subclass) => subclass.id),
    )

    expect(new Set(ids).size).toBe(ids.length)
  })
})
