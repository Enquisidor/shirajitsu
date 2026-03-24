export type DisplayMode = 'sidebar' | 'inline'
export type ContextMode = 'writer' | 'reader'

export interface UserSettings {
  displayMode: DisplayMode
  /** Manual override for auto-detected context; null = auto-detect */
  manualModeOverride: ContextMode | null
  showCommentaryLayer: boolean
  showUnverifiedAnnotations: boolean
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  displayMode: 'sidebar',
  manualModeOverride: null,
  showCommentaryLayer: true,
  showUnverifiedAnnotations: true,
}
