import type { AIModel } from './models.js'
import { DEFAULT_MODEL } from './models.js'

export type DisplayMode = 'sidebar' | 'inline'
export type ContextMode = 'writer' | 'reader'

export interface UserSettings {
  displayMode: DisplayMode
  /** Manual override for auto-detected context; null = auto-detect */
  manualModeOverride: ContextMode | null
  showCommentaryLayer: boolean
  showUnverifiedAnnotations: boolean
  /** The AI model the user has chosen for claim extraction */
  selectedModel: AIModel
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  displayMode: 'sidebar',
  manualModeOverride: null,
  showCommentaryLayer: true,
  showUnverifiedAnnotations: true,
  selectedModel: DEFAULT_MODEL,
}
