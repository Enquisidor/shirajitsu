import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModelSelector } from './ModelSelector'
import { DEFAULT_MODEL, SUPPORTED_MODELS } from '@shirajitsu/types'

describe('ModelSelector (compact)', () => {
  it('renders a dropdown with all supported models', () => {
    render(<ModelSelector value={DEFAULT_MODEL} onChange={() => {}} compact />)
    const select = screen.getByRole('combobox', { name: /select ai model/i })
    expect(select).toBeTruthy()
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(SUPPORTED_MODELS.length)
  })

  it('shows the currently selected model', () => {
    render(<ModelSelector value={DEFAULT_MODEL} onChange={() => {}} compact />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe(DEFAULT_MODEL.modelId)
  })

  it('calls onChange with the full AIModel object when selection changes', async () => {
    const onChange = vi.fn()
    render(<ModelSelector value={DEFAULT_MODEL} onChange={onChange} compact />)
    const select = screen.getByRole('combobox')
    const gpt4o = SUPPORTED_MODELS.find((m) => m.modelId === 'gpt-4o')!
    await userEvent.selectOptions(select, gpt4o.modelId)
    expect(onChange).toHaveBeenCalledWith(gpt4o)
  })
})

describe('ModelSelector (full)', () => {
  it('renders models grouped by provider', () => {
    render(<ModelSelector value={DEFAULT_MODEL} onChange={() => {}} />)
    expect(screen.getByText('Anthropic')).toBeTruthy()
    expect(screen.getByText('OpenAI')).toBeTruthy()
  })

  it('marks the selected model as checked', () => {
    render(<ModelSelector value={DEFAULT_MODEL} onChange={() => {}} />)
    const radio = screen.getByDisplayValue(DEFAULT_MODEL.modelId) as HTMLInputElement
    expect(radio.checked).toBe(true)
  })
})
