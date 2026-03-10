# Monopop

An Android inventory and shopping list manager. Offline-first, no backend, no account — all data lives in SQLite on the device.

Built for real daily use: the primary user manages inventory at work and shops aisle-by-aisle at the supermarket. Not a demo project — real data in production, real feedback loop, real consequences when things break.

[⬇️ Download APK](https://github.com/mahjard/monopop/releases/latest)

---

## Features

- **Multiple independent lists** — same products, separate inventory per list (work, home, etc.)
- **Shopping list with price tracking** — price auto-suggested per store, with fallback to any store
- **Lowest price in 90 days** — per product, loaded in background to avoid blocking interaction
- **Text import** — paste a list from any source; fuzzy matching maps to existing products
- **Purchase invoices** — on checkout, records a note with date, store and prices paid; history with zero extra effort
- **Spending analysis** — trend vs previous period, filterable by date and store
- **Quantity history** — tracks stock changes over time; calculates average weekly consumption
- **Drag-and-drop reordering** — custom inventory order, persisted in the database
- **Collapsible categories in shopping list** — aisle-by-aisle organization
- **Backup and restore** — exports everything as JSON; users are never locked in
- **100% offline** — no account, no internet, no network latency

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo SDK 54, bare workflow) |
| UI | React Native Paper (Material Design 3) |
| Database | expo-sqlite (SQLite, schema V8, WAL mode) |
| Navigation | React Navigation (Stack + Bottom Tabs) |
| Animations | Reanimated v4 |
| Runtime | New Architecture (JSI) enabled |

---

## Architecture

### Relational schema

`Product` (generic entity) is separate from `InventoryItem` (instance within a list) and `ShoppingListItem` (purchase intent). A product exists independently of lists; inventory is always scoped to a list. This allows the same product to appear across multiple lists with independent quantities without duplicating data.

`Invoice` + `InvoiceItem` emerge naturally from the checkout flow — per-product, per-store price history is built up with zero extra user effort. Actionable data as a natural consequence of use.

### State management

Two intentionally separate contexts: `ListContext` holds only `listId` + `setListId` (navigation selection); `ListDataContext` holds the data dependent on `listId`. Screens that only need the `listId` don't load the data overhead.

`BottomTabNavigator` receives `key={listId}` — when `listId` changes, the entire navigator remounts. Intentional side effect: local state across all tabs is cleared on list switch without explicit reset logic.

`ShoppingListScreen` uses a `FlatList` with a flat array of typed rows (`section-header | category-header | item`) instead of `SectionList`. Required for two levels of grouping (pending/cart + collapsible category sub-headers) — `SectionList` only supports one level natively.

### Two-phase loading

Main data arrives in a single JOIN query. Historical prices (`getLowestPriceForProducts` — JOIN across `invoice_items → invoices → stores`) load in background via `.then()`. The split is intentional: historical prices are informational, not blocking. The list is interactive immediately.

### Rendering encapsulation

`InventoryList` detects `sortOrder === 'category'` internally and switches between `DraggableFlatList` and `SectionList` without exposing this to `HomeScreen`. Drag-and-drop across categories would implicitly change a product's `categoryId` — powerful but risky to leave implicit. Clear behavior: drag disabled when sort is by category.

### Import logic reuse

`useImportEngine` exposes injectable callbacks (`applyMatch`, `applyNew`) instead of fixed behavior. The same import modal is reused for both inventory imports and shopping list imports with completely different behaviors — zero component duplication.

---

## Notable technical decisions

**New Architecture (JSI)** — the project came from an SDK migration and had never enabled the New Architecture. With JSI, SQLite calls no longer serialize/deserialize across the JSON bridge. Cold start: ~3s → ~1s. Roughly 90% of total performance gains came from this single change.

**WAL mode + PRAGMAs** — `synchronous = NORMAL`, `temp_store = memory`, `cache_size = -8000` configured explicitly. WAL eliminates lock overhead between concurrent reads and writes; repeat-visit load time dropped from ~900ms to ~33ms.*

**Indexes via migration** — after profiling, indexes added to `invoices`, `invoice_items` and `inventory_history` in the V8 migration. `getLowestPriceForProducts` dropped from 1287ms to 5ms.*

**Batch queries** — N+1 pattern eliminated. `getLowestPriceForProducts(ids[])`, `getLastUnitPricesForProductsAtStore`, `getLastUnitPricesForProducts` all return `Map<productId, value>` for O(1) lookup. The original code ran one query per item in a loop.

**Optimistic `useInventoryItem`** — saves quantity to the DB immediately to guarantee responsiveness of the +/− controls on HomeScreen. `EditInventoryItemScreen` handles this by storing `initialQuantityRef` to revert on discard, instead of trying to batch the save — which would break HomeScreen's behavior.

**`manualPrices` ref** — during a shopping session, manually edited prices are protected in a `useRef<Map>`. Switching stores doesn't overwrite what the user typed. Without this, the UX would be unacceptable for anyone who switches stores mid-session.

**`SearchablePickerDialog` with `embedded` prop** — nested Modal inside Modal has problematic behavior on Android. `embedded` mode renders only input + list without its own Portal/Modal, using `ScrollView` + `map` instead of `FlatList` (which collapses without an explicit height inside another Modal).

**`ConfirmationModal` extracted to a separate file** — when defined inside the parent component, React recreated it on every parent re-render, causing state resets mid import flow. Silent problem: the modal would visually close but its internal state was lost.

**`MaterialCommunityIcons` instead of Paper's `Checkbox`** — the native Paper component has `overflow: hidden` forced on Android, causing inconsistent icon clipping. Using the icon directly bypasses Paper's rendering pipeline and resolves the issue.

**Dirty tracking with `loadingRef` / `mountedRef`** — `loadAll` is async; without `loadingRef`, the internal `setState` calls triggered the dirty tracking `useEffect` before load finished, marking the screen as modified on open. `mountedRef` solves the same problem for the first render: without it, the `useEffect` with state deps runs on mount with initial values and immediately sets `isDirty = true`.

**Timezone fix** — `YYYY-MM-DD` dates from SQLite are interpreted as UTC midnight by JS. In UTC-3, they become the previous day. Fix: append `T00:00:00` before `parseISO` from date-fns to force local interpretation.

**`PRAGMA foreign_keys` outside transactions** — expo-sqlite doesn't allow this pragma inside `withTransactionAsync`. Solution: run it outside the transaction, with re-enable in `finally` to guarantee execution even on error.

**Versioned migration system** — `PRAGMA user_version` tracks the current schema. Each migration runs once. Allows safe schema evolution on devices with existing data. V1 → V8 in production.

*_Numbers from a previous session — not verified against current baseline._

---

## Product thinking

**`defaultStoreMode` (ask / last / fixed)** — instead of always prompting for a store or always assuming the last one, the user configures the behavior that fits their workflow. Someone who always shops at the same place uses `fixed`; someone who rotates uses `ask`. This kind of decision distinguishes a feature that works from a feature that adapts.

**Price pre-fill with cascading fallback** — on store selection, the app tries to fill prices from the last purchase at that specific store; if no history exists there, it falls back to the last price at any store. Users rarely need to type a price from scratch.

**`isFirstLoad` ref in ShoppingListScreen** — without this ref, `useFocusEffect` would reset the selected store every time the user returned from another tab. Small detail, real impact: the entire shopping session is organized around the selected store.

**`handleAcceptAllSuggestions`** — import generates per-product match suggestions. "Accept all" applies best-match silently. Came from real feedback: confirming 30 items individually was intolerable in practice.

**Collapsible categories during shopping** — the use case is genuine: the user moves aisle-by-aisle and collapses categories as each one is done, including items left pending due to price. Features that come from observed behavior tend to be more correct than ones from speculation.

**Date picker in `ConfirmInvoiceModal` defaulting to today** — retroactive checkout is a real use case (yesterday's shopping recorded today). Total preview visible before confirming — users shouldn't confirm an invoice without seeing the amount being recorded.

**Derived stats in `EditInventoryItemScreen`** — average weekly consumption, 90-day average price, and 90-day lowest price appear without any extra field or user effort. The data already existed in the tables; it's just a matter of computing it at the right moment. Users can review price history without entering edit mode.

**Product aliases (v1.6)** — the problem this solves is real: "whole milk" and "milk" are the same product, but nomenclature comes from invoices outside the user's control. Aliases are more robust than forcing manual standardization.

---

## Non-trivial debugging

**Silent bug in Hermes release** — `console.time` without a matching `timeEnd`, inside a `try` block without `finally`, threw a silent exception in Hermes release mode. The exception prevented `timeEnd` from running, which itself threw another exception, cutting the function mid-execution with nothing logged. The same code worked in debug. Identified by elimination using stepped alerts in a release build.

**`Promise.all` hanging indefinitely** — during debugging, one query neither resolved nor rejected; `await Promise.all` hung without entering the catch block. Diagnosis required replacing it with sequential awaits and intermediate alerts to isolate which query was hanging.

**SQLite cache as a useful side effect** — behavioral observation: waiting ~3s on HomeScreen before navigating made ShoppingListScreen load in <1s. The hypothesis was "SQLite warm-up", but the real cause was that the inventory queries populated the page cache with pages ShoppingListScreen also needed. Diagnosed through real usage pattern analysis, no external profiler. This led to `ListDataContext`: sharing data between screens instead of duplicate queries against the same tables.

**Silent bug in `saveInventoryHistorySnapshot`** — two coexisting bugs: (1) INSERT ignored `quantityToSave` and always used `currentInventoryItem.quantity`; (2) date matching SELECT used `=` instead of `LIKE`, silently failing on mixed formats in the DB from older versions. Result: corrupted history data in production with no visible error.

---

## Development context

Built with an AI coding agent (Cursor/Windsurf) following a structured workflow: prompt → code → confirmation → explicit diff review → commit → next issue. The explicit review before committing is part of the process — not blind trust in the agent.

**Package name and rename** — the app was called ListaÍ. During development, a competitor had already registered `com.listai.app` on the Play Store. The rename to Monopop was a product decision with a direct technical consequence: package name `com.mahjard.listai` is kept for now to avoid invalidating existing installs, but will be migrated before formal publishing.

Two APKs coexist on the user's device: `com.mahjard.listai` (release, daily use) and `com.mahjard.listai.dev` (debug, development). The `.dev` suffix via `applicationIdSuffix` was a deliberate decision to avoid overwriting the production app during development — standard practice in professional mobile teams.

---

## Project structure

```
src/
├── screens/       # HomeScreen, ShoppingListScreen, HistoryScreen, EditInventoryItemScreen, ...
├── components/    # ImportModal, ConfirmInvoiceModal, ShoppingListItemCard, DateRangePickerModal, ...
├── hooks/         # useImportEngine, useInventory, useListData
├── context/       # ListContext, ListDataContext
├── database/      # database.ts — all SQLite queries
└── utils/         # importParsers, similarityUtils, sortUtils, stringUtils
```

---

## Local build (Android)

```bash
cd android
./gradlew assembleRelease
```

APK at `android/app/build/outputs/apk/release/`. Requires JDK 17+ and Android SDK. `gradlew clean` needed after native changes; subsequent builds are fast via Gradle cache.

---

## Roadmap

- [ ] Product aliases — map equivalent names to avoid repeated prompts on import
- [ ] Cross-device sync (planned paid feature)
- [ ] Android widget for quick item addition without opening the app

---

Built by [Mah Jardim](https://github.com/mahjard)