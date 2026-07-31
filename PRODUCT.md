# Product

## Register

product

## Platform

web

## Users

Independent resellers of direct-sales brands (Natura, Avon, Hinode, and similar) in Brazil, managing their small business largely on their phone. Most have **little technical experience** and currently rely on spreadsheets or manual notes. Their job to be done is tracking what they bought, what they sold, and what they actually made — per batch (**lote**) and across the business overall — quickly, between customer interactions, often with unreliable connectivity.

## Product Purpose

Lotea replaces spreadsheets and manual math for direct-sales resellers. It lets a seller register inventory, record sales in a few taps, and always know what's in stock and what it's worth. Success is a seller who can, at any moment, see total investment, total revenue, total profit, current inventory value, sales history, performance broken down by lote, and — since so many sales in this business are "fiado" (delivered now, paid later) — exactly who owes her money, how much, and since when.

## Positioning

Know exactly where every product came from, what it cost, and how much profit every sale and every inventory lot generates — all in one place. Spreadsheets and generic budget apps don't model the **lote** as the core unit of the business; Lotea does.

## Brand Personality

Simple, fast, reliable. The app should never feel like accounting software — no jargon, no dense tables of unexplained numbers, no hidden actions. It should feel closer to Notion's ease, Google Sheets' clean organization, and Shopify's intuitive dashboards, translated into a single, calm mobile experience. Confidence comes from clarity, not from looking "professional" in a corporate sense.

## Anti-references

Cluttered, jargon-heavy accounting or ERP interfaces. Dense tables, hidden actions, or navigation that requires the user to already know how the app works. Anything that makes a first-time, non-technical user feel lost or intimidated.

## Design Principles

- **One consistent design across iOS and Android.** A single visual language and component set on both platforms — easier to learn, maintain, and scale — while still respecting native mobile behaviors (gestures, keyboards, system pickers) where it matters.
- **Every screen answers "how much did I make?"** Financial clarity (cost, revenue, profit) is never more than a glance away, whether looking at one lote or the whole business.
- **Minimum taps to the common actions.** Adding inventory and recording a sale are the two most frequent tasks and must stay fast and simple, even one-handed.
- **Never make the seller re-type a product from memory.** Adding a product to a lote must offer a searchable, typo-tolerant catalog with autocomplete as the seller types — ignoring accents and capitalization, matching partial words, and searching name, brand, category, code, volume, and variant together, showing enough detail (brand, volume, gender/variant, category) to tell similar products apart. Picking a suggestion fills in the product automatically; the seller then only enters what's specific to *this* lote — quantity, unit cost, expiry. The search draws first from a **global catalog shared by every reseller** (the well-known products thousands of sellers already carry — Natura Kaiak, Boticário Malbec, and so on — nobody should have to type one in from scratch) and otherwise from products the seller has already registered herself. If nothing matches either, a clear "Cadastrar novo produto" option is always available, but it first shows any close matches so a misspelling never quietly creates a duplicate catalog entry.
- **Never assume technical or financial literacy.** Plain language over terminology, icons always paired with labels, and no screen that requires prior training to understand.
- **Brazilian Portuguese by default, everywhere the user looks.** Every screen title, button, label, placeholder, validation message, notification, dialog, onboarding step, empty state, and error message is written in clear, natural pt-BR — simple and friendly, never translated-sounding or jargon-heavy. Code, file names, and technical docs stay in English per normal dev convention; only user-facing content is Portuguese. The app is built for translation from day one (all user-facing strings externalized, not hardcoded) so English can be added later as a secondary language, but pt-BR is the only language actually written and shipped initially — English is a future target, not part of the first release.
- **Resilient to poor connectivity.** Core flows (recording sales, checking stock) work offline and sync automatically once connection returns, since sellers can't always count on a signal.
- **Fiado is the normal case, not an edge case.** Finishing a sale never forces a binary "paid or not" choice — the seller enters what was actually received right then (which may be the full amount, part of it, or nothing), and the app figures out on its own whether that customer still owes anything. A customer can keep buying while she still owes from before; every sale stays trackable back to her, and a payment she makes later is applied automatically to her oldest debts first, so the seller never has to do that math by hand.

## Accessibility & Inclusion

Designed for users with little technical experience, including older users. Large, readable text with clear visual hierarchy; simple language with minimal technical/financial jargon, written in **Brazilian Portuguese (pt-BR)** throughout — every title, button, label, placeholder, validation message, notification, dialog, onboarding step, empty state, and error message; icons always paired with text labels, never icon-only; large touch targets; one-handed operation for the most common tasks (adding a product, recording a sale); high color contrast, with status never communicated by color alone; minimal steps for core actions; confirmation dialogs before destructive actions (e.g. deleting inventory or a sale record); graceful offline handling with local support for core features and automatic sync on reconnect.
