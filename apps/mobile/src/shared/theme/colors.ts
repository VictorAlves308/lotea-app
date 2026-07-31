/**
 * Lotea Design System v1.0 — resolved token values (see the design system
 * reference this was built from). Single source of truth: `tailwind.config.js`
 * mirrors these same hex values as NativeWind color tokens for `className`
 * use on Views; this module exists for the rare native/SVG API that needs a
 * literal color value instead (StatusBar, chart strokes, icon `stroke=`).
 */
export const palette = {
  // Primary — terracotta. The brand/action color. NOT used for money.
  primary: '#C74B28',
  primaryTint: '#F2E5DF',
  primaryDark: '#9A3A1F', // pressed/active state, darker than primary for contrast when needed

  // Ink — near-black warm neutral, and its muted steps.
  ink: '#121010',
  muted: '#6B6560',
  placeholder: '#9A948F',

  // Success — exclusively money received / confirmation / positive. Never decorative.
  success: '#278A49',
  successTint: '#E0F4E9',
  successStrong: '#1A7A3A', // text-on-tint (badges)
  successGlow: '#4FC87A', // on dark surfaces (hero card trend pill)

  // Warning / Danger
  warning: '#D97706',
  warningTint: '#FEF3CD',
  warningStrong: '#92610A', // text-on-tint
  danger: '#DC2626',
  dangerTint: '#FEE2E2',
  dangerSoftTint: '#FEF2EE', // lighter danger tint (alert cards, ghost-danger button bg)
  dangerStrong: '#9A2D0F', // text-on-tint

  // Surfaces
  bg: '#F7F6F3',
  surface: '#FFFFFF',
  divider: '#EDEAE4',
  dividerSoft: '#F0EDE7',
  dividerFaint: '#F5F2ED',
} as const;
