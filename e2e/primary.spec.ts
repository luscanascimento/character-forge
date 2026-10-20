import { expect, test, type Page } from '@playwright/test'
import { createStoredCharacter } from '../apps/web/src/test/characterFixture'

test('creates, persists, and reopens a local character draft', async ({ page }) => {
  await page.goto('/characters')
  await page.getByRole('button', { name: 'Create first character' }).click()

  await expect(page).toHaveURL(/\/forge\/[0-9a-f-]+$/)
  await page.getByLabel('Character name').fill('E2E Hero')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Shape their abilities' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Shape their abilities' })).toBeVisible()

  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'My characters' })
    .click()
  await expect(page.getByRole('heading', { name: 'E2E Hero' })).toBeVisible()
})

test('renders a canonically evaluated character sheet', async ({ page }) => {
  const document = createStoredCharacter()
  await page.route('**/api/characters/validate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(evaluation),
    })
  })

  await page.goto('/')
  await seedCharacter(page, document)
  await page.goto(`/characters/${document.id}/sheet`)

  const sheet = page.getByRole('article', { name: 'Arannis' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Armor class').locator('..').getByText('12')).toBeVisible()
  await expect(sheet.getByText(/canonically validated against SRD-5.2.1/i)).toBeVisible()
  await expect(page).toHaveScreenshot('character-sheet-desktop.png', { fullPage: true })
})

async function seedCharacter(page: Page, document: ReturnType<typeof createStoredCharacter>) {
  await page.evaluate(async (record) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('character-forge', 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains('characters')) {
          const store = database.createObjectStore('characters', { keyPath: 'id' })
          store.createIndex('by-updated-at', 'updatedAt')
        }
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('characters', 'readwrite')
        transaction.objectStore('characters').put(record)
        transaction.onerror = () => reject(transaction.error)
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
      }
    })
  }, document)
}

const evaluation = {
  validation: { isValid: true, violations: [] },
  derived: {
    baseAbilities: {
      strength: 8,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 10,
      charisma: 16,
    },
    effectiveAbilities: {
      strength: 8,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 10,
      charisma: 16,
    },
    abilityModifiers: {
      strength: -1,
      dexterity: 2,
      constitution: 1,
      intelligence: 1,
      wisdom: 0,
      charisma: 3,
    },
    proficiencyBonus: 2,
    armorClass: 12,
    walkingSpeed: 30,
    hasStealthDisadvantage: false,
    hitPointMaximum: 7,
    hitDie: 6,
    grantedProficiencies: [],
    spellcasting: null,
    weaponMasteries: [],
    weaponAttacks: [],
  },
}
