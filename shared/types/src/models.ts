export type AIProvider = 'anthropic' | 'openai' | 'google' | 'ollama'

export type SearchProvider = 'brave' | 'serpapi' | 'google-cse' | 'bing' | 'duckduckgo'

export const SUPPORTED_SEARCH_PROVIDERS: { id: SearchProvider; label: string }[] = [
  { id: 'brave', label: 'Brave Search' },
  { id: 'serpapi', label: 'SerpAPI (Google)' },
  { id: 'google-cse', label: 'Google Custom Search' },
  { id: 'bing', label: 'Bing Search' },
  { id: 'duckduckgo', label: 'DuckDuckGo' },
]

export const DEFAULT_SEARCH_PROVIDER: SearchProvider = 'google-cse'

export interface AIModel {
  provider: AIProvider
  /** Model identifier passed to the provider API */
  modelId: string
  /** Human-readable display name */
  label: string
  /** Short description shown in the selector */
  description: string
}

/** Per-million-token pricing for cost estimation in the session stats tooltip.
 *  Client-side only — update here when provider pricing changes, no backend deploy needed. */
export interface ModelPricing {
  /** USD per 1M input tokens */
  inputPer1M: number
  /** USD per 1M output tokens */
  outputPer1M: number
}

/** Canonical list of supported models. Add new entries here as providers release models. */
export const SUPPORTED_MODELS: AIModel[] = [
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    description: 'Anthropic — strong reasoning, recommended default',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-opus-4-5',
    label: 'Claude Opus 4',
    description: 'Anthropic — most capable, higher cost',
  },
  {
    provider: 'openai',
    modelId: 'gpt-4o',
    label: 'GPT-4o',
    description: 'OpenAI — fast and capable',
  },
  {
    provider: 'openai',
    modelId: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'OpenAI — high capability',
  },
  {
    provider: 'google',
    modelId: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    description: 'Google — long context, competitive performance',
  },
  {
    provider: 'ollama',
    modelId: 'llama3',
    label: 'Llama 3 (local)',
    description: 'Self-hosted via Ollama — requires local setup',
  },
]

export const DEFAULT_MODEL: AIModel = SUPPORTED_MODELS[0]

/** Pricing lookup keyed by modelId. Used by the session stats tooltip to estimate cost.
 *  Ollama/local models are free — omit from this map, treat as $0. */
export const MODEL_PRICING: Partial<Record<string, ModelPricing>> = {
  'claude-sonnet-4-20250514': { inputPer1M: 3.00,  outputPer1M: 15.00 },
  'claude-opus-4-5':          { inputPer1M: 15.00, outputPer1M: 75.00 },
  'gpt-4o':                   { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4-turbo':              { inputPer1M: 10.00, outputPer1M: 30.00 },
  'gemini-1.5-pro':           { inputPer1M: 1.25,  outputPer1M: 5.00  },
}
