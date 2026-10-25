#!/usr/bin/env bun

import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function extractQuickTunnelUrl(output) {
  return output.match(
    /https:\/\/[a-z0-9-]+(?:\.trycloudflare\.com|\.lhr\.life)\b/i,
  )?.[0]
}

export function resolveWebAssetPath(distRoot, pathname) {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    return undefined
  }

  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath
  const resolvedRoot = resolve(distRoot)
  const candidate = resolve(resolvedRoot, `.${requestedPath}`)
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${sep}`)) {
    return undefined
  }
  return candidate
}

async function main() {
  const webPort = positivePort(process.env.DEMO_WEB_PORT, 4173, 'DEMO_WEB_PORT')
  const apiPort = positivePort(process.env.DEMO_API_PORT, 3300, 'DEMO_API_PORT')
  const distRoot = resolve(repositoryRoot, 'webapp/dist')
  const children = new Set()
  let proxy
  let shuttingDown = false

  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) return
    shuttingDown = true
    proxy?.stop(true)
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    }
    await Promise.allSettled([...children].map(waitForExit))
    process.exit(exitCode)
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      void shutdown(0)
    })
  }

  try {
    console.log('Собираю мобильную и браузерную демо-версию KitchenFlow…')
    await runCommand(process.execPath, ['run', 'build:webapp'], {
      cwd: repositoryRoot,
      env: { ...process.env, VITE_API_URL: '' },
    })

    console.log('Создаю временный защищённый HTTPS-адрес…')
    const tunnel = spawnTunnel(webPort)
    children.add(tunnel.child)
    const publicUrl = await tunnel.url

    const backend = spawn(process.execPath, ['run', '--cwd', 'backend', 'start:api'], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PORT: String(apiPort),
        JWT_SECRET: randomBytes(32).toString('hex'),
        COOKIE_SECURE: 'true',
        CORS_ORIGINS: publicUrl,
        WEBAPP_ORIGIN: publicUrl,
        EMAIL_DELIVERY: 'disabled',
        PRIVATE_STORAGE_DRIVER: 'filesystem',
        PRIVATE_STORAGE_LOCAL_PUBLIC_URL: publicUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    children.add(backend)
    forwardPrefixedOutput(backend, 'backend')
    await waitForBackend(apiPort, backend)

    proxy = Bun.serve({
      hostname: '127.0.0.1',
      port: webPort,
      fetch: (request) => serveDemoRequest(request, { apiPort, distRoot }),
    })

    console.log('\nKitchenFlow готов к демонстрации:')
    console.log(publicUrl)
    console.log('\nОткройте эту ссылку на компьютере, телефоне или планшете.')
    console.log('Данные и загруженные файлы остаются на этом ноутбуке.')
    console.log('Чтобы закрыть доступ, нажмите Ctrl+C.\n')

    for (const child of children) {
      child.once('exit', (code, signal) => {
        if (shuttingDown) return
        console.error(`Демо-процесс остановился (${signal ?? `код ${code ?? 1}`}).`)
        void shutdown(code || 1)
      })
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    await shutdown(1)
  }
}

function positivePort(value, fallback, name) {
  if (value === undefined || value === '') return fallback
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} должен быть целым числом от 1 до 65535`)
  }
  return port
}

function spawnTunnel(webPort) {
  const provider = process.env.DEMO_TUNNEL_PROVIDER?.trim() || 'cloudflare'
  if (provider === 'localhost-run') return spawnLocalhostRunTunnel(webPort)
  if (provider !== 'cloudflare') {
    throw new Error('DEMO_TUNNEL_PROVIDER должен быть cloudflare или localhost-run')
  }

  const executable = process.env.CLOUDFLARED_BIN || 'cloudflared'
  const args = ['tunnel', '--url', `http://127.0.0.1:${webPort}`]
  const allowedEmail = process.env.DEMO_ALLOWED_EMAIL?.trim()
  if (allowedEmail) args.push('--allowed-mail', allowedEmail)

  const child = spawn(executable, args, {
    cwd: repositoryRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const url = new Promise((resolveUrl, reject) => {
    let output = ''
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Cloudflare не выдал временный адрес за 30 секунд.'))
    }, 30_000)

    const inspect = (chunk) => {
      output = `${output}${chunk}`.slice(-16_384)
      const tunnelUrl = extractQuickTunnelUrl(output)
      if (!tunnelUrl || settled) return
      settled = true
      clearTimeout(timeout)
      resolveUrl(tunnelUrl)
    }

    child.stdout?.on('data', inspect)
    child.stderr?.on('data', inspect)
    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(new Error(
        error.code === 'ENOENT'
          ? 'Не найден cloudflared. Установите его и повторите bun run demo:share.'
          : `Не удалось запустить cloudflared: ${error.message}`,
      ))
    })
    child.once('exit', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(new Error(
        `Cloudflare Tunnel завершился до получения адреса (${signal ?? `код ${code ?? 1}`}).`,
      ))
    })
  })

  return { child, url }
}

function spawnLocalhostRunTunnel(webPort) {
  if (process.env.DEMO_ALLOWED_EMAIL?.trim()) {
    throw new Error('DEMO_ALLOWED_EMAIL поддерживается только туннелем Cloudflare')
  }

  const child = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'UserKnownHostsFile=/private/tmp/kitchenflow-demo-known-hosts',
    '-o', 'ServerAliveInterval=30',
    '-T',
    '-R', `80:127.0.0.1:${webPort}`,
    'nokey@localhost.run',
  ], {
    cwd: repositoryRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const url = waitForTunnelUrl(child, 'localhost.run')
  return { child, url }
}

function waitForTunnelUrl(child, providerName) {
  return new Promise((resolveUrl, reject) => {
    let output = ''
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`${providerName} не выдал временный адрес за 30 секунд.`))
    }, 30_000)

    const inspect = (chunk) => {
      output = `${output}${chunk}`.slice(-16_384)
      const tunnelUrl = extractQuickTunnelUrl(output)
      if (!tunnelUrl || settled) return
      settled = true
      clearTimeout(timeout)
      resolveUrl(tunnelUrl)
    }

    child.stdout?.on('data', inspect)
    child.stderr?.on('data', inspect)
    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(new Error(`Не удалось запустить ${providerName}: ${error.message}`))
    })
    child.once('exit', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(new Error(
        `${providerName} завершился до получения адреса (${signal ?? `код ${code ?? 1}`}).`,
      ))
    })
  })
}

async function waitForBackend(port, child) {
  const endpoint = `http://127.0.0.1:${port}/health/ready`
  const deadline = Date.now() + 45_000

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('Backend демо-версии завершился при запуске.')
    }
    try {
      const response = await fetch(endpoint)
      if (response.ok) return
    } catch {
      // The API or local PostgreSQL is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }

  throw new Error('Backend не стал готов за 45 секунд. Проверьте локальную PostgreSQL.')
}

async function serveDemoRequest(request, { apiPort, distRoot }) {
  const url = new URL(request.url)
  if (
    url.pathname === '/health'
    || url.pathname.startsWith('/health/')
    || url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/storage/')
  ) {
    return proxyToBackend(request, apiPort)
  }

  const assetPath = resolveWebAssetPath(distRoot, url.pathname)
  if (!assetPath) return new Response('Not found', { status: 404 })

  const asset = Bun.file(assetPath)
  if (await asset.exists()) return staticResponse(request, asset, url.pathname)

  const index = Bun.file(resolve(distRoot, 'index.html'))
  return staticResponse(request, index, '/index.html')
}

async function proxyToBackend(request, apiPort) {
  const target = new URL(request.url)
  target.protocol = 'http:'
  target.hostname = '127.0.0.1'
  target.port = String(apiPort)

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('x-forwarded-proto', 'https')

  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  })

  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

function staticResponse(request, file, pathname) {
  const headers = new Headers({
    'Content-Type': file.type || 'application/octet-stream',
  })
  if (pathname === '/sw.js' || pathname === '/index.html') {
    headers.set('Cache-Control', 'no-cache')
  } else {
    headers.set('Cache-Control', 'public, max-age=3600')
  }
  return new Response(request.method === 'HEAD' ? null : file, { headers })
}

function forwardPrefixedOutput(child, name) {
  child.stdout?.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`))
  child.stderr?.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`))
}

function runCommand(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(
        `Команда завершилась с ошибкой (${signal ?? `код ${code ?? 1}`}): ${command} ${args.join(' ')}`,
      ))
    })
  })
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolvePromise) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      resolvePromise()
    }, 5_000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolvePromise()
    })
  })
}

if (import.meta.main) await main()
