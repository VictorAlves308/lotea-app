# Lotea

Lotea is a cross-platform mobile app (React Native + Expo, TypeScript, Expo Router, NativeWind) that lets direct-sales resellers (Natura, Avon, Hinode, and similar) track inventory, sales, and profit per batch ("lote") and overall — replacing spreadsheets and manual math. Backend is Node.js + Fastify + TypeScript, exposing a REST API backed by PostgreSQL.

## Design Context

Before making any implementation or design decision, read **PRODUCT.md** (register, users, positioning, brand personality, accessibility requirements) and **DESIGN.md** (visual system: colors, typography, components) at the project root. They are the source of truth for who this is for and how it should look and feel — do not improvise around them.

## Architecture

Before adding a feature, a route, or a new dependency, read **ARCHITECTURE.md** at the project root. It defines the feature-first folder structure for the mobile app and API, the layering rules on the server (route → controller → service → repository), the shared Zod-schema package, i18n, offline sync, and deployment approach — do not invent a different structure ad hoc.

## Database

Before touching `schema.prisma`, a migration, or any model/relationship, read **DATABASE.md** at the project root. It explains every model, the ER diagram, the audit-field policy, the product catalog search strategy, and every financial/inventory invariant (multi-tenant isolation, Decimal-only money, no persisted derived totals, the partial unique index preventing double-selling a unit, offline idempotency) — do not add a model or field that contradicts it without updating the doc first.

## Core Principles

- **Brazilian Portuguese (pt-BR) for all user-facing content, built i18n-ready for English later.** Screen titles, buttons, labels, placeholders, validation messages, notifications, dialogs, onboarding, empty states, and error messages must all be written in clear, natural, simple pt-BR — friendly and jargon-free, never a literal translation from English. Source code, file names, function/variable names, and technical documentation stay in English following normal dev convention. Externalize every user-facing string through an i18n layer (e.g. `i18next` / `expo-localization`) instead of hardcoding it in components, so English can be added as a second language later — but pt-BR is the only language actually written and shipped for now; don't author English copy or an `en` locale file up front.
- **Mobile-first.** Every screen is designed for one-handed phone use first; the target user is on their phone between customer interactions, not at a desk.
- **Simplicity over complexity.** No feature, screen, or interaction should require prior technical or accounting knowledge to understand.
- **Accessibility and ease of use.** Large touch targets, icons always paired with labels, high contrast, status never conveyed by color alone, confirmation dialogs before destructive actions. See PRODUCT.md's Accessibility & Inclusion section for the full list.
- **Clean, maintainable, scalable architecture.** Modular from the start on both frontend and backend, even while the project is small.
- **Commercial-friendly open source only.** Dependencies must be MIT, Apache 2.0, or BSD licensed, and compatible with running on free-tier infrastructure early on.
- **Consistency with the product vision and design system.** Every change should reinforce what's documented in PRODUCT.md and DESIGN.md, not drift from it.
