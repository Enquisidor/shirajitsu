export type AIProvider = 'anthropic' | 'openai' | 'google' | 'ollama'

export interface AIModel {
  provider: AIProvider
  /** Model identifier passed to the provider API */
  modelId: string
  /** Human-readable display name */
  label: string
  /** Short description shown in the selector */
  description: string
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
