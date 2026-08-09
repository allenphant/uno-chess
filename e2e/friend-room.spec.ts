import { expect, test } from '@playwright/test'

test('two guests can create, join, ready, and enter the same online match', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  await Promise.all([host.goto('/'), guest.goto('/')])
  await expect(host.getByTestId('create-friend-room')).toBeEnabled()
  await host.getByTestId('create-friend-room').click()
  const roomCode = (await host.getByTestId('friend-room-code').innerText()).replace(/\s/g, '')
  expect(roomCode).toMatch(/^[23456789A-HJ-NP-Z]{6}$/)

  await guest.getByTestId('room-code-input').fill(roomCode)
  await guest.getByTestId('join-friend-room').click()
  await expect(guest.getByTestId('friend-room-code')).toContainText(roomCode[0]!)
  await expect(host.getByTestId('ready-button')).toBeEnabled()

  await Promise.all([
    host.getByTestId('ready-button').click(),
    guest.getByTestId('ready-button').click(),
  ])

  await expect(host.getByTestId('online-match')).toBeVisible()
  await expect(guest.getByTestId('online-match')).toBeVisible()
  await expect(host.getByTestId('board')).toBeVisible()
  await expect(guest.getByTestId('board')).toBeVisible()

  await expect(host.getByRole('gridcell', { name: 'e2' })).toBeEnabled()
  await host.locator('.piece-sprite[data-square="e2"]').click()
  await host.getByRole('gridcell', { name: 'e4' }).click()
  await expect(host.locator('.piece-sprite[data-square="e4"]')).toBeVisible()
  await expect(guest.locator('.piece-sprite[data-square="e4"]')).toBeVisible()

  await Promise.all([hostContext.close(), guestContext.close()])
})
