import type { Annotation, Claim } from './annotation.js'
import type { AIModel, SearchProvider } from './models.js'

/** Sent by extension or SDK to the gateway */
export interface AnalyzeRequest {
  text: string
  /** 'writer' context applies cross-document tension checks if pub API is connected */
  context: 'writer' | 'reader'
  /** Optional: hashed platform user ID, required for partner API key auth */
  platformUserId?: string
  /** The AI model the user has selected. Gateway forwards this to claim-extractor.
   *  Optional: if omitted, the gateway uses the user's saved account preference. */
  model?: AIModel
  /** The search provider to use for source discovery.
   *  Optional: if omitted, falls back to the user's saved preference, then the service default. */
  searchProvider?: SearchProvider
}

/** Token usage reported by a single LLM call */
export interface LLMUsage {
  inputTokens: number
  outputTokens: number
}

/**
 * Aggregated stats for an analysis session, returned with every response.
 * Displayed in a hover tooltip beside the model selector in the claim bubble.
 * Cost is estimated client-side using per-model pricing rates so pricing
 * can be updated without a backend deploy.
 */
export interface SessionStats {
  claimsExtracted: number
  /** Total sources evaluated across all claims */
  sourcesEvaluated: number
  /** Total LLM calls: 1 extraction call + 1 framing call per claim */
  llmCalls: number
  /** Aggregated token counts across all LLM calls in this session */
  tokens: LLMUsage
  /** Model used — echoed back for display alongside the stats */
  model: AIModel
  /** Search provider used */
  searchProvider: SearchProvider
}

export interface AnalyzeResponse {
  annotations: Annotation[]
  /** Registry version used during this analysis */
  registryVersion: string
  analysisId: string
  /** Usage stats for this analysis — shown in hover tooltip beside model selector */
  sessionStats: SessionStats
}

/** Re-evaluate a single claim with overridden settings — used by the claim bubble UI */
export interface EvaluateClaimRequest {
  claim: Claim
  /** Override the search provider for this claim only */
  searchProvider?: SearchProvider
  /** Override the LLM used for framing analysis */
  model?: AIModel
}

export interface EvaluateClaimResponse {
  annotation: Annotation
  registryVersion: string
  /** Echoed back so the UI can display which provider was used */
  searchProvider: SearchProvider
  /** Incremental stats — UI adds these to running session totals */
  sessionStats: Pick<SessionStats, 'sourcesEvaluated' | 'llmCalls' | 'tokens'>
}

/** Auth modes the gateway accepts */
export type AuthMode =
  | { type: 'user-jwt'; token: string }
  | { type: 'platform-api-key'; key: string; platformUserId?: string }
  | { type: 'oauth'; token: string; platform: string }

export type ApiErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'validation_error'
  | 'provider_key_missing'  // selected model or search provider has no API key configured
  | 'rate_limited'
  | 'upstream_error'
  | 'internal_error'

export interface ApiError {
  code: ApiErrorCode
  message: string
  retryable: boolean
}
