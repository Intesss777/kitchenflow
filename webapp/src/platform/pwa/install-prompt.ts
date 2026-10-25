type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallationSnapshot = {
  installPrompt: BeforeInstallPromptEvent | null
  isStandalone: boolean
}

const listeners = new Set<() => void>()
let started = false
let snapshot: InstallationSnapshot = {
  installPrompt: null,
  isStandalone: readStandaloneMode(),
}

export function startPwaInstallationListener() {
  if (started) return
  started = true

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    updateSnapshot({ installPrompt: event as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => {
    updateSnapshot({ installPrompt: null, isStandalone: true })
  })
}

export function subscribeToPwaInstallation(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPwaInstallationSnapshot() {
  return snapshot
}

export async function requestPwaInstallation() {
  const prompt = snapshot.installPrompt
  if (!prompt) return
  await prompt.prompt()
  await prompt.userChoice
  updateSnapshot({ installPrompt: null })
}

function updateSnapshot(next: Partial<InstallationSnapshot>) {
  snapshot = { ...snapshot, ...next }
  for (const listener of listeners) listener()
}

function readStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}
