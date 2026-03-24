import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import type { AIModel } from '@shirajitsu/types'
import { DEFAULT_MODEL, SUPPORTED_MODELS } from '@shirajitsu/types'
import { ModelSelector } from '@shirajitsu/react'

export function SettingsPage() {
  const { user } = useUser()
  const [selectedModel, setSelectedModel] = useState<AIModel>(DEFAULT_MODEL)
  const [saved, setSaved] = useState(false)

  // Load saved preference from user's public metadata
  useEffect(() => {
    const saved = user?.publicMetadata?.selectedModel as AIModel | undefined
    if (saved && SUPPORTED_MODELS.some((m) => m.modelId === saved.modelId)) {
      setSelectedModel(saved)
    }
  }, [user])

  async function handleSave() {
    // TODO: persist via gateway user-settings endpoint
    // user.update({ publicMetadata: { selectedModel } }) requires backend Clerk API
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main>
      <h1>Settings</h1>

      <section>
        <h2>AI Model</h2>
        <p>
          Choose which AI model Shirajitsu uses to identify factual claims. Different models
          may produce different results — the analysis pipeline is identical regardless of which
          model you select.
        </p>
        <ModelSelector value={selectedModel} onChange={setSelectedModel} />
        <button onClick={handleSave}>
          {saved ? 'Saved' : 'Save preference'}
        </button>
      </section>
    </main>
  )
}
