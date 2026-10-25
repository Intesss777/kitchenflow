import { expect, test } from 'bun:test'
import { resolve } from 'node:path'

import { extractQuickTunnelUrl, resolveWebAssetPath } from './demo-share.mjs'

test('extracts the temporary Cloudflare URL from mixed tunnel output', () => {
  expect(extractQuickTunnelUrl([
    '2026-10-15T12:00:00Z INF Requesting new quick Tunnel',
    'https://quiet-river.trycloudflare.com',
  ].join('\n'))).toBe('https://quiet-river.trycloudflare.com')
})

test('extracts the temporary localhost.run URL from SSH output', () => {
  expect(extractQuickTunnelUrl([
    'Connect to http://localhost:4173',
    'Your URL is https://calm-river.lhr.life',
  ].join('\n'))).toBe('https://calm-river.lhr.life')
})

test('resolves web assets inside dist and rejects traversal', () => {
  const root = resolve('/tmp/kitchenflow-demo-dist')

  expect(resolveWebAssetPath(root, '/assets/app.js')).toBe(
    resolve(root, 'assets/app.js'),
  )
  expect(resolveWebAssetPath(root, '/')).toBe(resolve(root, 'index.html'))
  expect(resolveWebAssetPath(root, '/../private.txt')).toBeUndefined()
  expect(resolveWebAssetPath(root, '/%2e%2e/private.txt')).toBeUndefined()
})
