import type { Annotation } from './annotation.js'

/** Sent by extension or SDK to the gateway */
export interface AnalyzeRequest {
  text: string
  /** 'writer' context applies cross-document tension checks if pub API is connected */
  context: 'writer' | 'reader'
  /** Optional: hashed platform user ID, required for partner API key auth */
  platformUserId?: string
}

export interface AnalyzeResponse {
  annotations: Annotation[]
  /** Registry version used during this analysis */
  registryVersion: string
  analysisId: string
}

/** Auth modes the gateway accepts */
export type AuthMode =
  | { type: 'user-jwt'; token: string }
  | { type: 'platform-api-key'; key: string; platformUserId?: string }
  | { type: 'oauth'; token: string; platform: string }

export interface ApiError {
  code: string
  message: string
  retryable: boolean
}
