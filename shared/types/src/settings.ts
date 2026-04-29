import type { AIProvider, AIModel, SearchProvider } from './models.js'
import { DEFAULT_MODEL, DEFAULT_SEARCH_PROVIDER } from './models.js'

export type DisplayMode = 'sidebar' | 'inline'
export type ContextMode = 'writer' | 'reader'

/**
 * API keys the user has configured. Only providers with a key present here
 * are available for use. Shirajitsu does not pay for user LLM or search cycles.
 * Keys are stored encrypted server-side; this shape is used for client-side
 * availability checks (presence only — values are never sent to the client).
 */
export interface UserApiKeys {
  /** LLM provider keys — keyed by AIProvider */
  llm: Partial<Record<AIProvider, boolean>>
  /** Search provider keys — keyed by SearchProvider */
  search: Partial<Record<SearchProvider, boolean>>
}

export interface UserSettings {
  displayMode: DisplayMode
  /** Manual override for auto-detected context; null = auto-detect */
  manualModeOverride: ContextMode | null
  showCommentaryLayer: boolean
  showUnverifiedAnnotations: boolean
  /** The AI model the user has chosen for claim extraction and annotation framing analysis */
  selectedModel: AIModel
  /** The search provider used to find sources for each claim */
  selectedSearchProvider: SearchProvider
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  displayMode: 'sidebar',
  manualModeOverride: null,
  showCommentaryLayer: true,
  showUnverifiedAnnotations: true,
  selectedModel: DEFAULT_MODEL,
  selectedSearchProvider: DEFAULT_SEARCH_PROVIDER,
}
