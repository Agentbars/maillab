import { test, expect } from '@playwright/test'

const USER_EMAIL = 'e2e.dnd@maillab.local'
const USER_PASSWORD = 'Test1234!'

test.describe('Disk drag-and-drop to Trash', () => {
  test.beforeAll(async ({ request }) => {
    // Register test user once — 409 is fine if it already exists
    await request.post('/api/auth/register', {
      data: { email: USER_EMAIL, password: USER_PASSWORD },
    })
  })

  test('send mail with attachment → save to Disk → drag to Trash → verify', async ({ page }) => {
    const filename = `attachment-${Date.now()}.txt`
    const subject = `E2E attachment test ${filename}`

    // ── 1. Login ──────────────────────────────────────────────────────────────
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(USER_EMAIL)
    await page.locator('input[type="password"]').fill(USER_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('/inbox')

    // ── 2. Compose mail with generated attachment, send to self ───────────────
    await page.getByRole('button', { name: '+ New mail' }).click()
    await expect(page.getByText('New message')).toBeVisible()

    await page.getByPlaceholder('recipient@maillab.local').fill(USER_EMAIL)
    await page.getByPlaceholder('Subject').fill(subject)
    await page.getByPlaceholder('Write your message...').fill('Automated e2e test — please ignore.')
    await page.locator('input[type="file"]').setInputFiles({
      name: filename,
      mimeType: 'text/plain',
      buffer: Buffer.from('This is an auto-generated e2e test attachment.'),
    })

    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Message sent.')).toBeVisible()

    // Modal auto-closes after 1.2 s
    await expect(page.getByText('New message')).not.toBeVisible({ timeout: 5000 })

    // ── 3. Open received message in Inbox ─────────────────────────────────────
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(subject)).toBeVisible()
    await page.getByText(subject).first().click()
    await page.waitForURL(/\/inbox\/.+/)

    // ── 4. Save attachment to "Other" folder on Disk ──────────────────────────
    await page.getByRole('button', { name: 'Save to Disk' }).click()
    await expect(page.getByRole('heading', { name: 'Choose a folder' })).toBeVisible()
    await page.getByRole('button', { name: 'Other' }).click()
    await expect(page.getByText(`Saved as "${filename}" to Disk.`)).toBeVisible()

    // ── 5. Navigate to Disk ───────────────────────────────────────────────────
    await page.getByRole('link', { name: 'Disk' }).click()
    await page.waitForURL('/disk')

    // ── 6. Select "Other" folder — file must be visible ───────────────────────
    const otherFolder = page.locator('span.text-sm.truncate').filter({ hasText: /^Other$/ })
    await otherFolder.click()
    await expect(page.getByRole('cell', { name: filename })).toBeVisible()

    // ── 7. Drag file row onto Trash folder ────────────────────────────────────
    const fileRow = page.locator('tbody tr').filter({ hasText: filename })
    const trashFolder = page.locator('span.text-sm.truncate').filter({ hasText: /^Trash$/ })
    await fileRow.dragTo(trashFolder)
    await expect(page.getByText('Moved to Trash.')).toBeVisible()

    // ── 8. Open Trash and verify file is there ────────────────────────────────
    await trashFolder.click()
    await expect(page.getByRole('cell', { name: filename })).toBeVisible()
  })
})
