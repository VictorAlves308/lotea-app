# Architecture

This document defines how Lotea's code is organized and why. Read it before adding a feature, a route, or a new dependency. It complements [PRODUCT.md](PRODUCT.md) (why) and [DESIGN.md](DESIGN.md) (how it looks) — this file is about how the code is structured.

## 1. Stack

| Layer | Choice |
|---|---|
| Mobile client | React Native + Expo (managed workflow) |
| Routing | Expo Router (file-based) |
| Language | TypeScript everywhere, strict mode |
| Styling | NativeWind |
| Server state / data fetching | React Query |
| Forms | React Hook Form |
| Validation | Zod (shared between client and server) |
| API server | Fastify |
| ORM | Prisma |
| Database | PostgreSQL |

Every dependency added beyond this list must be MIT / Apache-2.0 / BSD licensed and compatible with running on free-tier infrastructure, per [CLAUDE.md](CLAUDE.md).

## 2. Guiding principle: Feature-First

Code is organized **by feature, not by technical layer.** A "layer-first" tree (`components/`, `hooks/`, `services/`, `controllers/` at the root, each hiding every feature inside) is what we're avoiding — it scales badly and scatters one feature's code across five unrelated folders.

Instead, each business capability — **auth**, **products** (inventory), **lots**, **sales**, **dashboard** (aggregated reporting) — is a self-contained module on both the client and the server, holding everything it needs: its own components/screens, its own data-fetching hooks or routes, its own validation schemas. A feature should be understandable, and mostly deletable, by looking at one folder.

`shared/` (client) and `shared/` (server) exist for code that is genuinely cross-feature (the design-system primitives, the API client, the Prisma client singleton, auth middleware). Default to putting new code inside the feature that owns it; only promote something to `shared/` once a second feature actually needs it.

## 3. Repository layout

A single repo, npm/pnpm workspaces, three packages:

```
lotea/
├── apps/
│   ├── mobile/              # Expo app
│   └── api/                 # Fastify server
├── packages/
│   └── shared/              # Zod schemas & types shared by mobile + api
├── PRODUCT.md
├── DESIGN.md
├── CLAUDE.md
├── ARCHITECTURE.md
└── package.json             # workspace root
```

`packages/shared` is what makes "validation defined once" real: a Zod schema for `Sale` or `Product` is written once, imported by the API to validate requests and by the mobile app to validate/type forms with `zodResolver`. Whenever a schema needs to be identical on both sides, it lives here — never redefined twice. It also holds the two small cross-cutting helpers every model relies on: `lib/id.ts` (the UUIDv7 generator, §6.2) and the decimal-as-string validation used for every monetary field (§6.4).

## 4. Mobile app (`apps/mobile`)

```
apps/mobile/
├── app/                          # Expo Router routes — thin, presentation-only
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (app)/
│   │   ├── (tabs)/
│   │   │   ├── dashboard.tsx
│   │   │   ├── products.tsx
│   │   │   ├── lots.tsx
│   │   │   └── sales.tsx
│   │   ├── products/[id].tsx
│   │   ├── lots/[id].tsx
│   │   └── sales/new.tsx
│   └── _layout.tsx
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/            # useLogin, useSession (React Query mutations)
│   │   │   ├── schemas.ts         # local re-exports from packages/shared, if any
│   │   │   └── api.ts             # calls into shared api client
│   │   ├── products/
│   │   │   ├── components/        # ProductForm, ProductListItem
│   │   │   ├── hooks/             # useProducts, useCreateProduct
│   │   │   ├── screens/           # ProductsScreen, ProductDetailScreen (stock shown, never edited directly)
│   │   │   └── api.ts
│   │   ├── inventory/
│   │   │   ├── components/        # InventoryItemListItem, RegisterEntryForm
│   │   │   ├── hooks/             # useInventoryItems, useRegisterEntry
│   │   │   ├── screens/           # StockHistoryScreen
│   │   │   └── api.ts
│   │   ├── lots/
│   │   ├── sales/
│   │   └── dashboard/
│   ├── shared/
│   │   ├── components/            # Button, Card, Input, EmptyState — the DESIGN.md primitives
│   │   ├── theme/                 # NativeWind tokens mapped from DESIGN.md
│   │   ├── i18n/                  # i18next setup, pt-BR strings (see §7)
│   │   ├── lib/
│   │   │   ├── api-client.ts      # fetch wrapper: base URL, auth header, error shape
│   │   │   ├── query-client.ts    # React Query client + AsyncStorage persistence
│   │   │   ├── offline-queue.ts   # outbox for offline mutations (see §8)
│   │   │   ├── storage.ts         # SecureStore / AsyncStorage helpers
│   │   │   └── env.ts             # Zod-validated runtime config
│   │   └── hooks/                 # useNetworkStatus, useDebounce, etc.
│   └── app-providers.tsx          # QueryClientProvider, i18n, theme, auth context
├── app.json
├── babel.config.js
├── tailwind.config.js
└── tsconfig.json
```

**Rules:**
- Files under `app/` only assemble a screen from feature components and call feature hooks — no business logic, no inline fetch calls.
- A feature's React Query hooks are the only place that talks to the API for that feature. Components never call `fetch`/the API client directly.
- Forms use `react-hook-form` + `zodResolver`, resolving against the schema from `packages/shared` whenever the shape is also validated server-side (all forms that submit to the API).
- Cross-feature imports go through `src/shared`, never feature-to-feature (`features/sales` must not reach into `features/products/components`). If two features need the same UI, that component moves to `shared/components`.

## 5. API server (`apps/api`)

```
apps/api/
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts       # Fastify plugin: registers endpoints
│   │   │   ├── auth.controller.ts   # HTTP <-> service translation
│   │   │   ├── auth.service.ts      # business logic (hashing, token issuing)
│   │   │   ├── auth.repository.ts   # Prisma calls, nothing else
│   │   │   └── auth.schemas.ts      # request/response Zod schemas (or re-exported from shared)
│   │   ├── products/
│   │   │   ├── products.routes.ts
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts   # createProduct() (computes searchTerms), searchProducts() — typo-tolerant
│   │   │   │                         # autocomplete + duplicate-check, one function for both. See DATABASE.md.
│   │   │   ├── products.repository.ts
│   │   │   └── products.schemas.ts
│   │   ├── inventory/
│   │   │   ├── inventory.routes.ts     # e.g. POST /inventory/entries, GET /products/:id/items
│   │   │   ├── inventory.controller.ts
│   │   │   ├── inventory.service.ts    # registerPurchaseEntry(), getAvailableCount(), getLotFinancials(),
│   │   │   │                           # markSold()/markInStock()/recordMovement() — the only writer of stock state
│   │   │   ├── inventory.repository.ts # InventoryItem Prisma calls + count/aggregation queries
│   │   │   └── inventory.schemas.ts
│   │   ├── lots/
│   │   │   ├── lots.routes.ts
│   │   │   ├── lots.controller.ts   # composes lots.service + inventory.service's getLotFinancials()
│   │   │   │                         # separately (not inside lots.service) to avoid a lots<->inventory
│   │   │   │                         # circular import — see §6.6
│   │   │   ├── lots.service.ts      # status-transition rules (ALLOWED_TRANSITIONS), never imports inventory
│   │   │   ├── lots.repository.ts
│   │   │   └── lots.schemas.ts
│   │   ├── catalog/
│   │   │   ├── catalog.routes.ts      # GET /catalog/search, GET /catalog/:id — no create/update/delete yet
│   │   │   ├── catalog.controller.ts
│   │   │   ├── catalog.service.ts     # searchCatalog(), getActiveCatalogProduct() — same shape as products'
│   │   │   │                          # equivalents, minus tenant scoping. See §6.8 and DATABASE.md.
│   │   │   ├── catalog.repository.ts
│   │   │   └── catalog.schemas.ts
│   │   ├── sales/
│   │   │   ├── sales.routes.ts       # POST /sales, GET /sales/:id, POST /sales/:id/cancel — deliberately
│   │   │   │                         # minimal, no generic list, no "change customer" (see §6.9)
│   │   │   ├── sales.controller.ts   # also maps Decimal fields (total/paidAmount/salePrice/...) to wire
│   │   │   │                         # strings — the service layer keeps returning real Decimals, since
│   │   │   │                         # seed.ts/tests do further Decimal arithmetic on the result
│   │   │   ├── sales.service.ts      # calls inventoryService's public functions (never its repository
│   │   │   │                         # directly) to mark items SOLD and record movements, computes profit
│   │   │   │                         # from each SaleItem's frozen acquisitionCostSnapshot, and resolves
│   │   │   │                         # receivedAmount/customerId via customersService — see §6.9
│   │   │   ├── sale-status.ts        # computeSaleStatus() — a standalone leaf module (not part of
│   │   │   │                         # sales.service.ts) so customers.service.ts can import it without a
│   │   │   │                         # sales<->customers circular import, same reasoning as §6.6's lots/inventory split
│   │   │   ├── sales.repository.ts
│   │   │   └── sales.schemas.ts
│   │   ├── customers/
│   │   │   ├── customers.routes.ts      # create/edit/search/get/list, payments (register/void),
│   │   │   │                            # statement, receivables-summary — see §6.9 and DATABASE.md
│   │   │   ├── customers.controller.ts  # also maps CustomerPayment/PaymentAllocation Decimal amounts to
│   │   │   │                            # wire strings, same reasoning as sales.controller.ts
│   │   │   ├── customers.service.ts     # createCustomerWithDuplicateCheck() mirrors products' pattern;
│   │   │   │                            # registerPayment()/voidPayment() do the FIFO distribution —
│   │   │   │                            # locked, idempotent, deterministically ordered — see §6.9
│   │   │   ├── customers.repository.ts  # also reads/writes Sale.paidAmount/status directly for payment
│   │   │   │                            # registration/void — a deliberate, documented exception to
│   │   │   │                            # per-feature model ownership; see §6.9
│   │   │   └── customers.schemas.ts
│   │   └── dashboard/
│   │       ├── dashboard.routes.ts     # GET /dashboard/financial — one consolidated endpoint
│   │       ├── dashboard.controller.ts
│   │       ├── dashboard.service.ts    # pure orchestrator — no dashboard.repository.ts; see §6.10
│   │       └── dashboard.schemas.ts
│   ├── plugins/
│   │   ├── prisma.ts                # decorates Fastify with a Prisma client singleton
│   │   ├── authenticate.ts          # JWT verification plugin, decorates `request.userId`
│   │   ├── rate-limit.ts            # @fastify/rate-limit global default; per-route overrides live in each
│   │   │                             # feature's routes.ts via shared/lib/rate-limit-config.ts
│   │   ├── openapi.ts               # @fastify/swagger + swagger-ui, served at /documentation
│   │   ├── error-handler.ts         # maps thrown errors -> consistent JSON error shape
│   │   ├── cors.ts
│   │   └── sensible.ts
│   ├── shared/
│   │   ├── lib/
│   │   │   ├── env.ts               # Zod-validated process.env, fails fast on boot
│   │   │   ├── jwt.ts               # sign/verify access tokens (jsonwebtoken)
│   │   │   ├── password.ts          # hash/verify passwords (bcryptjs)
│   │   │   ├── tokens.ts            # opaque refresh-token generation + SHA-256 hashing
│   │   │   ├── rate-limit-config.ts # per-route rate-limit helper (relaxed automatically under NODE_ENV=test)
│   │   │   ├── retry.ts             # retrySerializationFailures() — bounded retry on Postgres P2034
│   │   │   ├── lot-apportionment.ts # apportionAmountByWeight() — exact-cent proportional split; see §6.10
│   │   │   └── logger.ts
│   │   └── errors/                  # NotFoundError, ValidationError, etc.
│   ├── app.ts                       # builds the Fastify instance, registers plugins + features
│   └── server.ts                    # entrypoint: app.listen()
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── tsconfig.json
```

**Request flow inside a feature (strict one-direction dependency):**

```
route (HTTP verbs/paths, wires plugin)
  -> controller (parses/validates request via Zod, calls service, shapes response)
    -> service (business rules: e.g. "profit = saleItem.salePrice − saleItem.acquisitionCostSnapshot")
      -> repository (Prisma queries only — no business logic here)
```

A repository never contains business logic; a service never imports Prisma directly; a controller never talks to the database. This is what "clean separation of concerns" means concretely here — each layer has exactly one reason to change.

**Rules:**
- Every route input (body, params, query) is validated with a Zod schema before it reaches the controller. Fastify's schema validation hook does this — invalid input never reaches business logic.
- Cross-feature reads (e.g., the dashboard reading sales + products + lots) go through the other features' service functions, not through their repositories directly — services are a feature's public interface, repositories are private to it.
- **`inventory` is the only feature allowed to write stock state.** No other feature ever imports `inventory.repository` directly; `sales`, and any future adjustment flow, call `inventory.service`'s exported functions (`registerPurchaseEntry()` / `markSold()` / `markInStock()` / `recordMovement()`) instead — the service module is the feature's public interface even for cross-feature transactional writes, the repository stays private to it.

## 6. Data modeling conventions

Non-negotiable rules for every Prisma model, established from the first migration so retrofitting them never becomes a project of its own. **[DATABASE.md](DATABASE.md) is the authoritative deep-dive** — every model and relationship explained, an ER diagram, the audit-field policy in full, the product catalog search strategy, and every financial/inventory invariant with the test that covers it. This section states the conventions; DATABASE.md shows them applied to the real, implemented schema.

### 6.1 One schema, models map to features

One `schema.prisma`, one migration history, at the root of `apps/api`. Prisma's schema isn't feature-split (Prisma doesn't support that well); the models still map cleanly onto features: `User` → auth, `Product` → products, `CatalogProduct` → catalog, `Lot` → lots, `InventoryItem` / `InventoryMovement` → inventory, `Sale` / `SaleItem` → sales. Migrations are committed to the repo and run as a deploy step, never applied by hand against production.

### 6.2 IDs: always UUIDv7

Every model's primary key is a **UUIDv7** — time-ordered, so IDs sort chronologically and stay index-friendly (unlike UUIDv4), while remaining safe to generate offline (a sale recorded without connectivity needs a real, collision-safe ID before it ever reaches the server). Postgres and Prisma don't generate UUIDv7 natively, so IDs are generated in application code via a shared helper (`packages/shared/src/lib/id.ts`, wrapping the MIT-licensed `uuidv7` package) — **never** `@default(uuid())` (that generates v4) and never a DB-side default. Columns are still native Postgres `uuid` (`@db.Uuid`), just populated by the app, not the database.

### 6.3 Audit fields on every model

Every model carries, from its very first migration:
- `createdAt`, `updatedAt` — timestamps (`@default(now())` / `@updatedAt`).
- `deletedAt` — nullable, soft-delete marker (never a hard delete on a record that can have history against it — a product a seller no longer stocks, but has sales against, is soft-deleted so profit reporting stays correct).
- `createdBy`, `updatedBy` — the acting `User.id` (from `request.user`, set by the auth plugin), attributing every write to a real person from day one.

There is no Prisma "base model" inheritance, so these five fields are repeated verbatim in every model block — copy them, don't reinvent them per model.

### 6.4 Monetary values: Decimal, never Number/Float

Every monetary value — cost, price, sale total, per-unit cost — is `Decimal` in Prisma (`@db.Decimal(10, 2)`), from the schema through to the API boundary. This is non-negotiable: `Number`/`Float` accumulate rounding error, and accurate profit is this app's entire reason to exist.
- **Wire format:** `Decimal` has no native JSON representation; API responses serialize monetary fields as **strings** (`"149.90"`, never `149.9`), and the mobile client parses them into a decimal-safe type before doing any arithmetic — never straight into a JS `number`.
- Zod schemas in `packages/shared` validate monetary fields as numeric strings, matching the wire format, so the same schema enforces this on both sides.

### 6.5 Status fields: real enums, never loose strings

Any field representing a finite set of states is a **Prisma enum**, never a free-text column. Example, `LotStatus`:

```prisma
enum LotStatus {
  ACTIVE
  FINISHED
  ARCHIVED
}
```

`InventoryItem.status` (§6.6) follows the same rule. A loose string status is a silent invitation for a typo'd value to slip past validation; an enum fails at the schema level instead.

### 6.6 Stock is units, not quantity — `InventoryItem`

**Don't model quantity — model units.** A `quantity` integer sitting on `Product` or `Lot` collapses ten physical, individually-sellable units into one number, losing which unit came from which lot, at what cost, and whether it's still in stock. Instead, each physical unit is its own row:

```
Lot              (a purchase batch: status ACTIVE/FINISHED/ARCHIVED, purchase date, total cost paid)
  └─ Product        (the catalog entry this batch is for, e.g. "Kaiak")
       └─ InventoryItem  ⭐  (one row per physical unit: id 1 Kaiak, id 2 Kaiak, ... id 10 Kaiak)
            └─ Sale          (references the specific InventoryItem(s) sold, never a quantity)
```

- **Registering an "Entrada"** (buying N units into a lot) creates **N individual `InventoryItem` rows** via `inventory.service.ts`'s `registerPurchaseEntry()`, each with `productId`, `lotId`, `status: IN_STOCK`, and `acquisitionCost` copied from the lot at creation time (frozen, so a later edit to the lot's cost never retroactively changes a unit already sold). The API accepts a quantity as *input* to that one action (how many units were bought) — it just never persists that number anywhere; it fans out into rows.
- **Registering a "Venda"** (`sales.service.ts`'s `createSale()`) takes the specific `InventoryItem`(s) the seller picked (a mobile UI, not the server, decides which physical units — there's no server-side FIFO auto-selection), validates each is `IN_STOCK`, and flips it to `SOLD` via `inventoryService.markSold()`, in the same Prisma transaction that creates the `Sale` / `SaleItem` record — never a bare decrement.
- **Current stock** for a product is `COUNT(*) WHERE productId = X AND status = 'IN_STOCK'`; for a lot, the same query scoped by `lotId`. Both are computed on read by `inventory.repository.ts`, never stored.
- This also gives exact profit-per-lot for free: each sold item's `SaleItem` still carries the `acquisitionCostSnapshot` frozen from its own lot, so `salePrice − acquisitionCostSnapshot`, summed per lot, is accurate even when the same product was bought at different costs across different lots — the "performance by lot" data PRODUCT.md requires falls out of this model directly. Full detail (including why a *second* snapshot on `SaleItem` isn't redundant with `InventoryItem.acquisitionCost`) is in DATABASE.md's "Financial invariants".

### 6.7 Product catalog search: typo-tolerant, no paid APIs

Adding a product to a lot must not depend on the seller typing a perfectly-spelled, perfectly-cased product name from scratch every time — that's how the same physical product ends up as five slightly-different catalog rows. `Product.searchTerms` is a normalized (lowercase, accent-stripped), service-maintained blob of every searchable field (`name`, `brand`, `category`, `sku`, `volume`, `variant` — never `notes`), searched via Postgres's `pg_trgm` extension (`word_similarity` + an ILIKE fallback, both accelerated by one GIN index) for typo tolerance and partial-term matching. **No paid or commercially-restricted product database or API** — `pg_trgm` is a free, standard Postgres contrib module, consistent with the free-tier-infrastructure rule in §1. One search function (`products.service.ts`'s `searchProducts()`) serves both as-you-type autocomplete and the "check for duplicates before creating a new product" flow. Full strategy, the exact query, and why plain `similarity()` was rejected in favor of `word_similarity()`: DATABASE.md, "Product catalog search". This is the *per-tenant* search over each seller's own registered products — see §6.8 for the separate, global catalog.

### 6.8 Global product catalog: shared reference data, not tenant-scoped

`CatalogProduct` (a new, self-contained `catalog` feature — repository/service/controller/routes, no imports of its own, a "leaf" feature like `auth`) is a **global** table with no `userId`: every authenticated user searches the same rows. It exists so that the thousands of resellers who sell the exact same well-known products (Natura Kaiak, Boticário Malbec, ...) don't each type one in from scratch — picking a search result copies its fields into a new, ordinary tenant-scoped `Product` once, via `products.service.ts` calling `catalogService.getActiveCatalogProduct()` (the same cross-feature service-to-service read pattern `inventory.service.ts` already uses for `productsService`). That `Product` never depends on the catalog entry again afterward, even if it's later edited or deactivated — `Product.catalogProductId` is a provenance pointer only, never re-read for display.

Creating a Product from the catalog reuses the existing `POST /products` route (extended additively to accept `catalogProductId` as an alternative to a manual `name`) rather than adding a second creation endpoint — the same duplicate-check and validation logic applies either way. Search stays a separate endpoint (`GET /catalog/search`, alongside the existing `GET /products/search`) since the two queries are scoped completely differently (global vs. per-tenant); the mobile client composes both result sets rather than the server merging them. Full design (search machinery, seed strategy, the "never depends on the catalog again" invariant): DATABASE.md, "Global product catalog".

### 6.9 Accounts receivable ("fiado"): a mutual dependency, resolved without a cycle

`Customer`/`CustomerPayment`/`PaymentAllocation` (a new `customers` feature) plus `Sale.customerId`/`paidAmount`/`status` (finally made real — `Sale.status` had been hardcoded to `PAID` since the MVP schema was first written) implement buy-now-pay-later sales, automatic FIFO payment distribution across a customer's open sales, and cancellation. This is also where `sales` gets its first HTTP routes — `sales.service.ts`/`sales.repository.ts` existed since the MVP schema but had none.

**The genuine architectural wrinkle**: sale creation needs `customersService` (to resolve a `customerId` and record the initial payment), and payment registration/void need to mutate `Sale.paidAmount`/`status` — a naive design has `sales` and `customers` importing each other's services, exactly the circular dependency §6.6's lots/inventory split avoids. The resolution, in two parts:
1. `computeSaleStatus` (the pure function that derives `Sale.status` from `total`/`paidAmount`/cancelled) lives in its own leaf module, `sales/sale-status.ts` — not inside `sales.service.ts` — so `customers.service.ts` can import just that, with nothing importing back.
2. `customers.repository.ts` reads and writes `Sale.paidAmount`/`status` directly for payment-driven mutations (registration, void) — a deliberate, narrow, documented exception to "one feature owns one model." `sales.repository.ts` only ever writes those same fields at *creation*; the two never write the same field on the same code path, so there's no real ownership conflict, just a split by *when* in the sale's lifecycle each feature is the writer.

**FIFO distribution, locking, and idempotency**: `registerPayment` (`customers.service.ts`) locks a customer's open sales with `SELECT ... FOR UPDATE`, a fully deterministic `ORDER BY "createdAt" ASC, "id" ASC` (never bare `createdAt` — concurrent registration/void transactions for the same customer must request locks in the same order to serialize instead of deadlocking), sums the balance from the just-locked rows (never a stale pre-transaction read), then walks the sales oldest-first allocating `min(remaining, saleBalance)` to each. `CustomerPayment.idempotencyKey` mirrors `Sale.idempotencyKey`'s exact mechanism. Full algorithm, the cancellation-blocking rule, the historical-sale exception, and the four receivables indicators: DATABASE.md, "Accounts receivable".

**Minimal sales HTTP surface, each route justified against a real use**: `POST /sales`, `GET /sales/:id` (statement drill-down target), `POST /sales/:id/cancel`. No generic `GET /sales` list (a customer's sales are already reachable via her statement) and no "change customer" endpoint — every sale with `paidAmount < total` already requires a customer at creation, so no sale can ever legally reach a state where changing it afterward would be valid; that endpoint was cut entirely rather than shipped unused.

### 6.10 Financial dashboard: cross-feature aggregation without a cross-feature repository

`dashboard.service.ts` (§5) is a pure orchestrator with **no `dashboard.repository.ts` at all** — a first draft had one reaching directly into `Sale`/`SaleItem`/`CustomerPayment`/`Product`/`InventoryItem`, a direct violation of §5's own rule that cross-feature reads go through the other features' service functions, not their repositories. Fixed by relocating every new aggregate into the feature that already owns the underlying model — `sales.service.ts` (status counts, average ticket, sold timeline), `customers.service.ts` (received timeline, recent payments), `products.service.ts` (top products/brands, mirroring how `inventory.service.ts` already reads through `Sale`/`SaleItem` for lot financials) — and having `dashboard.service.ts` call all of them in parallel (`Promise.all`) and assemble the response. See DATABASE.md, "Financial dashboard", for the exact split, the date/timezone rules, and the `date_trunc` bucket-alignment requirement.

**"Dívida por lote" is a derived view, not a new financial entity.** A customer's debt stays strictly singular (§6.9's FIFO, unchanged); "which lots does this balance come from" is answered by grouping her currently-open sales by lot, computed fresh on every read. Since a single Sale can contain items from more than one lot (nothing constrains it to one), a multi-lot sale's outstanding balance is split across its lots by exact, cent-for-cent proportional attribution — `shared/lib/lot-apportionment.ts`'s `apportionAmountByWeight`, a small pure function (Decimal-only, largest-remainder method, deterministic tie-break), used from exactly one place: `inventory.service.ts`'s per-lot "clientes com saldo" aggregate. It is deliberately **not** built on the customer side — her detail screen already shows her open sales (and, via `GET /sales/:id`, each item's own lot) with zero apportionment math, and an aggregated, rateio-derived number next to that exact one would describe a split she never actually made. See DATABASE.md, "Lot composition", for the full algorithm and the exactness guarantees.

## 7. Internationalization

Per PRODUCT.md and CLAUDE.md: **pt-BR is the only language written and shipped right now**, but every user-facing string goes through the i18n layer from day one so English can be added later without a rewrite.

- Client: `i18next` + `react-i18next`, initialized in `src/shared/i18n/`, with one `pt-BR.json` resource file per feature (`features/products/pt-BR.json`, etc.) rather than one giant global file — keeps translations colocated with the feature that owns them, consistent with feature-first.
- No hardcoded user-facing strings in components — always `t('products.form.costLabel')`, never a literal string in JSX.
- API error messages returned to the client are error **codes** (`PRODUCT_NOT_FOUND`, `INSUFFICIENT_STOCK`), translated to pt-BR copy on the client through the same i18n layer — the server never hardcodes a human-facing sentence, so the same API can serve a future English client unchanged.

## 8. Offline support

Per PRODUCT.md's connectivity requirement, the two core flows (recording a sale, checking stock) must work offline and sync automatically on reconnect:

- React Query's cache is persisted to `AsyncStorage` (`@tanstack/query-async-storage-persister`), so reads (product list, stock levels) are available offline from the last successful sync.
- Writes made offline (a new sale) are appended to a local outbox (`shared/lib/offline-queue.ts`) instead of firing immediately; a `useNetworkStatus` hook (via `@react-native-community/netinfo`) flushes the queue in order as soon as connectivity returns, with each mutation re-validated against the same Zod schema used online before it's sent.
- The UI reflects a queued write immediately (optimistic update through React Query) with a subtle "pending sync" indicator — never a blocked or frozen screen while offline.

## 9. Auth

- JWT access token (short-lived, default 15 min) + opaque refresh token (long-lived, default 30 days), issued by `features/auth` on the server. See DATABASE.md, "Authentication" for the full token lifecycle (registration, login, refresh rotation, logout).
- Access tokens are signed/verified with the `jsonwebtoken` package directly (`shared/lib/jwt.ts`), not `@fastify/jwt` — this is deliberate: it keeps `auth.service.ts` a plain, Fastify-agnostic function that can be unit/integration-tested without spinning up a Fastify instance, consistent with every other feature service in this codebase.
- Refresh tokens are **not** JWTs. They're random 32-byte values (`shared/lib/tokens.ts`), returned to the client once and stored server-side only as a SHA-256 hash (`RefreshToken.tokenHash`) — a leaked database row can't be replayed as a live session. Each refresh call rotates the token (old row revoked, new row issued, same transaction).
- Passwords are hashed with `bcryptjs` (`shared/lib/password.ts`, 12 salt rounds) — a pure-JS implementation chosen so the API has no native module to compile/rebuild across platforms.
- Tokens are stored on-device via `expo-secure-store`, never `AsyncStorage` (which is unencrypted).
- The Fastify `authenticate` plugin (`plugins/authenticate.ts`) verifies the access token and decorates `request.userId` (not `request.user` — only the id is needed past this point, and every repository query is scoped by plain `userId` anyway, see DATABASE.md's "Multi-tenant isolation"). Any route that needs an authenticated seller registers it via `fastify.addHook('preHandler', fastify.authenticate)` at the feature's routes-plugin level, not ad-hoc checks inside controllers.
- Auth endpoints (and product search) carry tighter per-route rate limits than the global default, via a `rateLimitConfig()` helper (`shared/lib/rate-limit-config.ts`) built on `@fastify/rate-limit` — see §5 for where it's registered.

## 10. Environment & configuration

Both apps validate their environment at startup with a Zod schema (`shared/lib/env.ts` on the server, `src/shared/lib/env.ts` on the client reading `expo-constants`), and **fail fast on boot** if a required variable is missing or malformed — never a silent `undefined` reaching runtime code.

## 11. Testing

- Unit tests colocated with the code they test (`*.test.ts` next to the file), not a parallel `__tests__` tree — keeps a feature's tests inside its own folder.
- Server: service-layer logic (especially profit/total calculations) gets the heaviest test coverage; repositories are thin enough to lean on integration tests against a test database instead of mocking Prisma.
- Client: feature hooks and form validation (Zod schemas) are the highest-value tests; screen-level tests are lighter, focused on the golden path per feature.
- Shared Zod schemas in `packages/shared` are tested once, in place — both apps inherit that coverage by construction.

## 12. Deployment

Kept to free-tier-compatible, easy-to-migrate infrastructure while the project is small:

- **API + Postgres**: a single free-tier host that offers both (e.g., Railway or a managed Postgres like Neon alongside a free Node host) — swappable later since the app only depends on a standard `DATABASE_URL` and doesn't use provider-specific features.
- **Mobile**: Expo EAS Build for producing iOS/Android binaries; Expo's OTA updates for shipping JS-only fixes without an app-store review cycle.
