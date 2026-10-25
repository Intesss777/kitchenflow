export type PwaInstallationState =
  | 'installed'
  | 'prompt'
  | 'apple-instructions'
  | 'browser-menu'

export function resolvePwaInstallationState(input: {
  hasInstallPrompt: boolean
  isAppleMobile: boolean
  isStandalone: boolean
}): PwaInstallationState {
  if (input.isStandalone) return 'installed'
  if (input.hasInstallPrompt) return 'prompt'
  if (input.isAppleMobile) return 'apple-instructions'
  return 'browser-menu'
}

export function isAppleMobilePlatform(input: {
  maxTouchPoints: number
  platform: string
  userAgent: string
}) {
  return /iPhone|iPad|iPod/i.test(input.userAgent)
    || (input.platform === 'MacIntel' && input.maxTouchPoints > 1)
}
