/**
 * selectionHelpers.ts — UNIMPLEMENTED STUB
 *
 * This file is a placeholder that exists only so test imports resolve.
 * ISS-005 must implement the correct versions of these functions.
 * All tests importing from this file MUST fail at Phase 1.
 */

export type SelectionContext = {
  text: string
  wordCount: number
}

/**
 * STUB — not implemented.
 * ISS-005 acceptance criteria: returns first 80 chars + '…' when text.length > 80.
 */
export function selectionPreview(_text: string): string {
  // Intentionally returns wrong value — not implemented yet (ISS-005)
  return ''
}

/**
 * STUB — not implemented.
 * ISS-005 acceptance criteria: returns selection.wordCount >= 5.
 */
export function selectionMeetsLengthRequirement(_selection: SelectionContext): boolean {
  // Intentionally returns wrong value — not implemented yet (ISS-005)
  return false
}
