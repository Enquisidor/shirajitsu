import type { AIModel, AIProvider } from '@shirajitsu/types'
import { SUPPORTED_MODELS } from '@shirajitsu/types'

interface ModelSelectorProps {
  value: AIModel
  onChange: (model: AIModel) => void
  /** If true, renders as a compact dropdown for the popup. Full list view otherwise. */
  compact?: boolean
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  ollama: 'Ollama (local)',
}

export function ModelSelector({ value, onChange, compact = false }: ModelSelectorProps) {
  if (compact) {
    return (
      <select
        className="model-selector model-selector--compact"
        value={value.modelId}
        onChange={(e) => {
          const model = SUPPORTED_MODELS.find((m) => m.modelId === e.target.value)
          if (model) onChange(model)
        }}
        aria-label="Select AI model"
      >
        {SUPPORTED_MODELS.map((m) => (
          <option key={m.modelId} value={m.modelId}>
            {m.label}
          </option>
        ))}
      </select>
    )
  }

  // Group by provider for the full settings view
  const byProvider = SUPPORTED_MODELS.reduce<Record<AIProvider, AIModel[]>>(
    (acc, m) => {
      acc[m.provider] = [...(acc[m.provider] ?? []), m]
      return acc
    },
    {} as Record<AIProvider, AIModel[]>,
  )

  return (
    <div className="model-selector" role="radiogroup" aria-label="Select AI model">
      {(Object.entries(byProvider) as [AIProvider, AIModel[]][]).map(([provider, models]) => (
        <div key={provider} className="model-selector__group">
          <span className="model-selector__provider">{PROVIDER_LABELS[provider]}</span>
          {models.map((m) => (
            <label key={m.modelId} className={`model-selector__option ${m.modelId === value.modelId ? 'model-selector__option--selected' : ''}`}>
              <input
                type="radio"
                name="model"
                value={m.modelId}
                checked={m.modelId === value.modelId}
                onChange={() => onChange(m)}
              />
              <span className="model-selector__label">{m.label}</span>
              <span className="model-selector__description">{m.description}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}
