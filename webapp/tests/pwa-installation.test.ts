import { expect, test } from 'bun:test'

import {
  isAppleMobilePlatform,
  resolvePwaInstallationState,
} from '../src/platform/pwa/model'

test('the install manifest exposes standalone branded icons', async () => {
  const manifest = await Bun.file(
    new URL('../public/manifest.webmanifest', import.meta.url),
  ).json() as {
    display: string
    icons: Array<{ purpose: string; sizes: string; src: string }>
    name: string
    start_url: string
    theme_color: string
  }

  expect(manifest.name).toBe('KitchenFlow')
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('/')
  expect(manifest.theme_color).toBe('#c96442')
  expect(manifest.icons).toEqual([
    expect.objectContaining({ sizes: '192x192', src: '/pwa-icon-192.png' }),
    expect.objectContaining({
      purpose: 'any maskable',
      sizes: '512x512',
      src: '/pwa-icon-512.png',
    }),
  ])

  for (const icon of manifest.icons) {
    const file = Bun.file(new URL(`../public${icon.src}`, import.meta.url))
    expect(await file.exists()).toBe(true)
    expect(file.size).toBeGreaterThan(0)
  }
})

test('installed display mode wins over every installation hint', () => {
  expect(resolvePwaInstallationState({
    hasInstallPrompt: true,
    isAppleMobile: true,
    isStandalone: true,
  })).toBe('installed')
})

test('a captured browser prompt enables one-click installation', () => {
  expect(resolvePwaInstallationState({
    hasInstallPrompt: true,
    isAppleMobile: false,
    isStandalone: false,
  })).toBe('prompt')
})

test('Apple mobile devices receive the home-screen instruction', () => {
  expect(resolvePwaInstallationState({
    hasInstallPrompt: false,
    isAppleMobile: true,
    isStandalone: false,
  })).toBe('apple-instructions')
})

test('other browsers fall back to their application menu', () => {
  expect(resolvePwaInstallationState({
    hasInstallPrompt: false,
    isAppleMobile: false,
    isStandalone: false,
  })).toBe('browser-menu')
})

test('iPad desktop user agents still receive Apple installation instructions', () => {
  expect(isAppleMobilePlatform({
    maxTouchPoints: 5,
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
  })).toBe(true)
  expect(isAppleMobilePlatform({
    maxTouchPoints: 0,
    platform: 'MacIntel',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
  })).toBe(false)
})
