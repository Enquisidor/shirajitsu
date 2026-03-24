import type { AnalyzeRequest, AnalyzeResponse, ApiError } from '@shirajitsu/types'

export interface ShirajitsuClientOptions {
  /** Platform API key issued by Shirajitsu */
  apiKey: string
  /** Optional: anonymised platform user ID for per-user rate limiting */
  platformUserId?: string
  /** Override gateway URL — useful for testing */
  gatewayUrl?: string
}

export class ShirajitsuClient {
  private readonly apiKey: string
  private readonly platformUserId?: string
  private readonly gatewayUrl: string

  constructor(options: ShirajitsuClientOptions) {
    this.apiKey = options.apiKey
    this.platformUserId = options.platformUserId
    this.gatewayUrl = options.gatewayUrl ?? 'https://api.shirajitsu.com'
  }

  /**
   * Analyse text and return annotations.
   * This is the primary entry point for platform integrations.
   */
  async analyze(text: string, context: AnalyzeRequest['context'] = 'reader'): Promise<AnalyzeResponse> {
    const body: AnalyzeRequest = {
      text,
      context,
      ...(this.platformUserId && { platformUserId: this.platformUserId }),
    }

    const res = await fetch(`${this.gatewayUrl}/v1/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Partial<ApiError>
      throw new ShirajitsuError(
        err.message ?? `Request failed with status ${res.status}`,
        err.code ?? 'UNKNOWN',
        err.retryable ?? false,
      )
    }

    return res.json() as Promise<AnalyzeResponse>
  }

  /** Convenience: create a new client scoped to a specific platform user */
  forUser(platformUserId: string): ShirajitsuClient {
    return new ShirajitsuClient({
      apiKey: this.apiKey,
      platformUserId,
      gatewayUrl: this.gatewayUrl,
    })
  }
}

export class ShirajitsuError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'ShirajitsuError'
  }
}
