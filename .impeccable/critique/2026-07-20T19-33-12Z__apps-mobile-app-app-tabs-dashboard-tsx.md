---
target: apps/mobile dashboard screen
total_score: 26
p0_count: 2
p1_count: 1
timestamp: 2026-07-20T19-33-12Z
slug: apps-mobile-app-app-tabs-dashboard-tsx
---
# Design Health Score

| # | Heuristic | Score | Key Finding |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Skeleton + pull-to-refresh work; no "last updated" timestamp |
| 2 | Match System / Real World | 3 | "Ticket médio" was jargon (fixed to "Valor médio por venda") |
| 3 | User Control and Freedom | 2 | Ranking rows and payment rows aren't tappable — dead ends (no detail screens exist yet) |
| 4 | Consistency and Standards | 2 → fixed | Green was used for both "Pago" and "Parcial" — recolored so green means only "Pago" |
| 5 | Error Prevention | 4 | n/a — no destructive actions on this screen |
| 6 | Recognition Rather Than Recall | 4 | Tabular-nums everywhere; genuinely disciplined |
| 7 | Flexibility and Efficiency | 2 | Only 3 period presets, no custom range, no export |
| 8 | Aesthetic and Minimalist Design | 3 | Mostly clean; added a persistent chart legend |
| 9 | Error Recovery | 2 | One generic error message regardless of cause |
| 10 | Help and Documentation | 1 | No inline help; vocabulary unexplained for a first-timer |
| **Total** | | **26/40** | **Acceptable at time of critique — several P0/P1 fixed same session** |

## Anti-Patterns Verdict: PASS
Zero gradient text, zero glassmorphism, zero uppercase eyebrows, zero side-stripe borders (confirmed independently by a qualitative review and a literal pattern-grep).

## What's Working
1. Tabular-figure discipline (`fontVariant: tabular-nums`) applied to every number on screen.
2. `SegmentedControl`'s track+pill+hitSlop pattern — compact ~38px visual pill, real ≥44px tap target.
3. Chart's accessibility engineering — nearest-x hit-testing, clamped tooltip, full pt-BR accessible summary.

## Priority Issues (fixed this session)
- **[P0]** Primary button's own text failed contrast at rest (3.77:1, needs 4.5:1) — fixed: `primary-600`→`primary-700` for every text use of the accent color.
- **[P0]** Green used for "Parcial" (partially paid), not just "Pago" — fixed: status bar/legend now step through neutral ink tones for every non-confirmed state.
- **[P1]** Resting-state shadow on `SegmentedControl`'s selected pill broke DESIGN.md's Flat-By-Default Rule — fixed: shadow removed.
- **[P2]** Arbitrary `text-[32px]` off Tailwind's scale on the headline numbers — fixed: `text-4xl`.
- **[P2]** Three screens, three different title treatments — fixed: unified to `text-3xl font-bold tracking-tight` across dashboard/login/home.

## Not fixed (flagged for a product decision)
No profit/margin figure exists anywhere on the dashboard, despite PRODUCT.md stating "every screen answers 'how much did I make?'" as a core principle. `GET /dashboard/financial` doesn't return a profit/COGS figure today — this needs new backend aggregation, not a styling change.

## Persona Red Flags
- **Alex (power user)**: ranking/payment rows aren't tappable; no custom date range or export.
- **Jordan (first-timer)**: jargon and color-alone status signaling, both fixed this session; still no inline help anywhere.

## Minor Observations (fixed this session)
- `Skeleton`'s radius (`rounded-xl`) didn't match the `Card` panels it stands in for (`rounded-2xl`) — unified.
- `index.tsx`'s tagline was the only text left on `ink-500` (4.76:1) instead of the app's `ink-600` standard (7.58:1) — fixed.
- The same green hex was hand-typed in 3 places instead of one shared source — consolidated into `theme/colors.ts`'s `palette`.
- `StatusLegendItem`'s count text was missing `tracking-tight` present on every sibling tabular-number element — added.
