// ── View theme: HUD/menu chrome tokens (FUI pass, 2026-08-13) ──────────────────
// Sci-fi FUI styling per the ui-ux-pro-max design-system run for Shard Dominion:
// quantum-cyan primary, interference-purple secondary, deep indigo-black panels,
// Share Tech Mono display type. Semantic colors (credits gold, warning red,
// success green, faction team colors) intentionally stay OUTSIDE this theme —
// they carry gameplay meaning and must not shift with chrome restyles.
// View-layer only: nothing in src/sim/** may import this module.

export const THEME = {
  /** Deep indigo-black panel fill (replaces flat rgba(0,0,0,0.7)). */
  panel: 'rgba(5, 8, 20, 0.82)',
  /** Panel/overlay backdrop for full-screen DOM menus. */
  overlay: 'rgba(5, 5, 16, 0.93)',
  /** Primary FUI accent — quantum cyan (pre-existing site accent, kept). */
  cyan: '#00e5ff',
  /** Translucent cyan fill for active/hover chrome. */
  cyanFill: 'rgba(0, 229, 255, 0.14)',
  /** Cyan glow (canvas shadowColor / CSS text-shadow color). */
  cyanGlow: 'rgba(0, 229, 255, 0.55)',
  /** Secondary accent — interference purple (tech/upgrade chrome). */
  purple: '#9b7bff',
  /** Idle chrome border on dark panels. */
  border: '#26374a',
  /** Primary UI text. */
  text: '#e2e8f0',
  /** Dimmed UI text. */
  dim: '#8fa3b8',
} as const;

/** Canvas font stack — Share Tech Mono with a monospace fallback while loading. */
export const FONT_FAMILY = "'Share Tech Mono', monospace";

/** Canvas ctx.font builder: font(12) → "12px 'Share Tech Mono', monospace". */
export function font(px: number, bold = false): string {
  return `${bold ? 'bold ' : ''}${px}px ${FONT_FAMILY}`;
}
