/**
 * Tension colour utilities.
 *
 * Maps a TensionRating.score (0.0–1.0) to a colour on a blue→red gradient
 * by interpolating hue linearly in HSL space.
 *
 *   score 0.0 → hsl(220, …) — blue   (sources frame consistently)
 *   score 0.5 → hsl(290, …) — purple (midpoint, emerges from hue path)
 *   score 1.0 → hsl(360, …) — red    (sources diverge substantially)
 *
 * Purple is not a hardcoded stop — it falls out of the continuous hue
 * interpolation from 220° to 360°. The score alone determines the colour.
 *
 * Both the Chrome extension and web app import from here so the gradient
 * is defined exactly once.
 */

const HUE_START = 220  // blue
const HUE_END   = 360  // red, reached by travelling clockwise through purple
const SATURATION = 85  // % — constant across the gradient
const LIGHTNESS  = 58  // % — constant across the gradient

function hue(score: number): number {
  const t = Math.max(0, Math.min(1, score))
  return Math.round(HUE_START + (HUE_END - HUE_START) * t)
}

/**
 * Returns an `hsl(…)` string for the given tension score.
 * Use for opaque fills: badges, bubble borders, inline highlight strokes.
 *
 * @example
 * tensionColor(0)    // 'hsl(220, 85%, 58%)' — blue
 * tensionColor(0.5)  // 'hsl(290, 85%, 58%)' — purple
 * tensionColor(1)    // 'hsl(360, 85%, 58%)' — red
 */
export function tensionColor(score: number): string {
  return `hsl(${hue(score)}, ${SATURATION}%, ${LIGHTNESS}%)`
}

/**
 * Returns an `hsla(…)` string for the given tension score and alpha.
 * Use for translucent fills: inline highlight backgrounds, hover states.
 *
 * @example
 * tensionColorAlpha(0.8, 0.15)  // 'hsla(275, 85%, 58%, 0.15)'
 */
export function tensionColorAlpha(score: number, alpha: number): string {
  return `hsla(${hue(score)}, ${SATURATION}%, ${LIGHTNESS}%, ${alpha})`
}
