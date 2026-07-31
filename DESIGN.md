<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: Lotea
description: Lote-based inventory and profit tracking for direct-sales resellers.
---

# Design System: Lotea

## 1. Overview

**Creative North Star: "The Trusted Ledger"**

Lotea should feel like a calm, competent assistant doing the math a reseller doesn't have time for — never like accounting software. The palette stays quiet: tinted neutrals carrying almost the entire surface, with a single green accent reserved for the moments that matter (profit, confirmed sales, positive balances). Typography is a single, highly legible grotesque sans in the Inter / SF Pro family — medium-weight headings, regular-weight body, generous spacing — so a seller with little technical experience can scan a screen and understand it in seconds. Motion is responsive, not choreographed: fast, smooth feedback on every tap, no orchestrated entrances or scroll sequences to slow anyone down.

This system explicitly rejects cluttered, jargon-heavy accounting or ERP interfaces — dense tables, hidden actions, or navigation that assumes prior training. Every screen should read as approachable and immediate, closer to Notion's ease, Google Sheets' plain structure, Shopify's dashboard clarity, and Nubank's polished, trustworthy fintech feel (its aesthetic confidence, not its color palette).

**Key Characteristics:**
- Restrained neutral base; one green accent, used sparingly and meaningfully
- Single sans-serif family, no display/body pairing
- Flat by default; depth conveyed through tonal layering, not shadows
- Fast, purposeful motion only — feedback, not spectacle
- Icons always paired with text labels, never icon-only

## 2. Colors

**The Restrained Rule.** Tinted neutrals carry the surface; the green accent appears on ≤10% of any given screen — profit figures, positive states, primary actions. Its rarity is what makes it legible as "good news" at a glance.

### Primary
- **Accent Green** (`[to be resolved during implementation — a clear, confident green, not a muted sage or neon lime]`): Reserved for profit numbers, positive balances, confirmations, and the primary action button. Never decorative.

### Neutral
- **Base neutral** (`[to be resolved during implementation]`): Backgrounds and surfaces. A true or lightly-tinted neutral, not the cream/sand AI-default — leaning cool-neutral to read as "financial tool," not "editorial site."
- **Ink** (`[to be resolved during implementation]`): Body text and headings. Must clear 4.5:1 contrast against the base neutral; this is a non-negotiable given the low-literacy, older-user accessibility requirement.
- **Muted ink** (`[to be resolved during implementation]`): Secondary text (labels, timestamps, helper copy) — still must clear 4.5:1, not a washed-out gray.

### Named Rules
**The No-Ambiguity Rule.** Status is never communicated by color alone (per PRODUCT.md's accessibility requirements) — a negative balance or loss gets a label or icon alongside any red/color cue, never color by itself.

## 3. Typography

**Body Font:** Inter, or SF Pro on iOS-native contexts, with system-ui fallback `[exact stack to be resolved at implementation]`
**Display Font:** none — single family throughout

**Character:** A neutral, highly legible grotesque sans built for scanning numbers and short labels quickly, not for personality. Medium weight carries hierarchy; the typeface itself stays out of the way.

### Hierarchy
- **Headline** (medium weight, `[size to be resolved]`): Screen titles, section headers.
- **Title** (medium weight, `[size to be resolved]`): Card headers, lote names, list-item primary text.
- **Body** (regular weight, `[size to be resolved]`): Descriptions, helper text, form labels. Larger than typical default given the older-user, low-technical-literacy audience.
- **Label** (regular weight, `[size to be resolved]`): Metadata, timestamps, secondary numbers.

### Named Rules
**The Scan-First Rule.** Every number a seller needs (cost, revenue, profit) must be readable without zooming or squinting — err toward larger type and shorter lines over density.

## 4. Elevation

Flat by default, with depth conveyed through tonal layering (a slightly lighter or darker neutral surface, not a shadow) between the background and cards/sheets. Shadows are reserved for genuinely floating elements — modals, bottom sheets, toasts — never for resting cards, matching the "calm assistant" character over a "busy dashboard" one.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow appears only when something is truly overlaying the rest of the screen (modal, sheet, toast), never as decoration on a static card.

## 5. Components

*Component specifics are deferred until there's real code to extract from — re-run `/impeccable document` once screens exist. The rules below hold regardless of exact values.*

### Buttons
- **Primary:** Carries the accent green; reserved for the single most important action on a screen (record sale, save product).
- **Secondary / Ghost:** Neutral-toned, for all other actions — most screens should have exactly one green button, not several competing for attention.

### Cards / Containers
- **Background:** A tonal step from the page background (see Elevation), not a hard-shadowed card.
- **Shape:** Soft, comfortable corners — large enough to feel calm, not sharp or clinical.

### Inputs / Fields
- **Style:** Large touch targets, clear focus state, label always visible (never placeholder-only, per the low-literacy accessibility requirement).
- **Error:** Paired icon + text, never color alone (see Named Rules under Colors).

### Navigation
- **Style:** Simple, icon + label tab bar for primary navigation — never icon-only, per PRODUCT.md's accessibility requirements. Optimized for one-handed reach.

## 6. Do's and Don'ts

### Do:
- **Do** keep the accent green rare and meaningful — profit, confirmation, primary action only.
- **Do** pair every icon with a text label, always.
- **Do** favor larger type and shorter lines over density; this app is used by people with little technical experience, some older.
- **Do** keep motion fast and purposeful — a tap should feel instantly acknowledged.
- **Do** show a confirmation dialog before any destructive action (deleting inventory or a sale record).

### Don't:
- **Don't** build cluttered, jargon-heavy, accounting/ERP-style interfaces — dense tables, hidden actions, or navigation that assumes prior training.
- **Don't** communicate status (profit/loss, in-stock/out-of-stock) with color alone.
- **Don't** use icon-only controls anywhere in the app.
- **Don't** add scroll-driven or choreographed entrance animations — motion here is feedback, not spectacle.
- **Don't** default to a cream/sand neutral base "for warmth" — this is a financial tool; the neutral should read calm and clear, not like an editorial site.
