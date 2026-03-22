# List Export/Import — Feature Spec
**Project:** Monopop  
**Version:** v1.7.0  

---

## Overview

Allow users to export a single list as a JSON file and share it with others. Recipients can import it into their own app, merging with existing data non-destructively. Designed for the "family sync" use case — one person maintains the full inventory and shares it with whoever is doing the shopping.

---

## Use Case

Family member A has a fully configured list (inventory, prices, purchase history). They export it and send via WhatsApp. Family member B imports it — their existing lists are untouched, the new list is added alongside them.

---

## Export

### Trigger
`ListsScreen` long-press action sheet → new **"Compartilhar lista"** option alongside Renomear/Excluir.

### Export Format
```json
{
  "type": "list_export",
  "version": "1.0",
  "exportedAt": "2026-03-18T20:00:00.000Z",
  "listName": "Mercado",
  "data": {
    "categories": [...],
    "stores": [...],
    "products": [...],
    "inventory_items": [...],
    "inventory_history": [...],
    "shopping_list_items": [...],
    "invoices": [...],
    "invoice_items": [...],
    "product_store_prices": [...],
    "product_base_prices": [...]
  }
}
```

### File Naming
`monopop-lista-{listName}-{timestamp}.json`  
Example: `monopop-lista-Mercado-2026-03-18-20h00.json`

### Share Mechanism
`expo-sharing` via cache file — same pattern as existing `BackupScreen.handleShare`.

---

## Import

### Entry Points
Three triggers, all route to the same logic:

| Trigger | How |
|---|---|
| `BackupScreen` | New "Importar Lista" card, separate from full backup import |
| `ListsScreen` | Import icon in `Appbar` |
| Intent filter | Opening a `.json` file from WhatsApp/Files/email auto-routes to `BackupScreen` with data pre-loaded |

### File Type Detection
```
Incoming JSON file
    ↓
data.type === 'list_export' && data.version
    → list import

data.tables && data.version && data.exportedAt && data.tables.lists
    → full backup import (including pre-v1.7 backups without type field)

neither
    → Alert 'Arquivo inválido'
```

### Import Flow
```
Select / receive file
    ↓
Detect type → list_export
    ↓
Step 1: Categories
    Exact name match → reuse existing id
    No match → create new
    Silent, no user interaction
    ↓
Step 2: Stores
    Exact name match → reuse existing id
    No match → create new
    Silent, no user interaction
    ↓
Step 3: Products (interactive)
    Exact match → silent, reuse existing
    Fuzzy match (≥0.55) → ConfirmationModal (existing component)
    No match → create new
    ↓
Step 4: Build ID translation maps from steps 1–3
    categoryIdMap: Map<number, number>  (oldId → newId)
    storeIdMap: Map<number, number>
    productIdMap: Map<number, number>
    ↓
Step 5: Create new list
    If name already exists → append " (importada)"
    ↓
Step 6: Insert remaining data using translated IDs
    inventory_items      → build inventoryItemIdMap
    inventory_history    → uses inventoryItemIdMap
    shopping_list_items  → uses inventoryItemIdMap
    invoices             → build invoiceIdMap, uses storeIdMap
    invoice_items        → uses invoiceIdMap + productIdMap
    product_store_prices → uses productIdMap + storeIdMap
    product_base_prices  → uses productIdMap
    ↓
ImportSummaryModal
    ↓
OK → navigate to ListsScreen
```

### Conflict Handling
- **Categories / stores:** silent exact match by name, create if missing
- **Products:** interactive via `useImportEngine` — user controls matching
- **List name:** if duplicate exists, append " (importada)" automatically
- **No overwrites:** all existing data on recipient's device is untouched — import is purely additive

---

## New Files

### `utils/backupUtils.ts`
Extracted and extended from `BackupScreen`:
- `buildFullBackup()` — existing `buildExportData` logic, moved here
- `buildListExport(listId: number)` — new, queries only data for that list
- `shareJsonFile(jsonString, fileName)` — shared helper for both export paths

### `utils/listImportUtils.ts`
Pure import logic, no UI:
- `importListExport(data, callbacks)` — ID remapping + DB insertion
- `callbacks` interface delegates product matching to `useListImportEngine`
- Fully isolated, no React dependencies

### `hooks/useListImportEngine.ts`
Orchestration hook:
- Wraps `useImportEngine` for the product matching step (Step 3)
- Drives the full import flow (Steps 1–6)
- Returns `{ startListImport, confirmationModalElement, summaryModalElement }`

---

## Modified Files

### `BackupScreen.tsx`
- Extract `buildExportData` → `buildFullBackup` in `backupUtils.ts`
- Add **"Exportar Lista"** section with list picker + share button
- Add **"Importar Lista"** card (no data wipe warning — additive only)
- Read `route.params?.pendingListImport` on mount → auto-trigger import
- Read `route.params?.pendingBackupImport` on mount → auto-trigger existing full backup import
- Navigate to `Lists` after successful import (both full and list)

### `ListsScreen.tsx`
- Add import icon (`import`) to `Appbar` → triggers file picker → list import
- Add **"Compartilhar lista"** to long-press action sheet
- Export uses the long-pressed list's id

### `App.tsx`
- Move `navigationRef` from `AppContent` to `App`, pass to `NavigationContainer`
- Pass `navigationRef` as prop to `AppContent`
- Add `Linking` handler in `AppContent`:
  - `Linking.getInitialURL()` — handles cold start from file open
  - `Linking.addEventListener('url', ...)` — handles warm start
  - Reads file, parses JSON, detects type, navigates accordingly

### `android/app/src/main/AndroidManifest.xml`
Add inside the `<activity>` block:
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/json" />
</intent-filter>
```

### `src/types/navigation.ts`
Add to `RootStackParamList`:
```typescript
Backup: {
  pendingListImport?: ListExportData;
  pendingBackupImport?: any;
} | undefined;
```

---

## Types

```typescript
// utils/backupUtils.ts
export interface ListExportData {
  type: 'list_export';
  version: string;
  exportedAt: string;
  listName: string;
  data: {
    categories: any[];
    stores: any[];
    products: any[];
    inventory_items: any[];
    inventory_history: any[];
    shopping_list_items: any[];
    invoices: any[];
    invoice_items: any[];
    product_store_prices: any[];
    product_base_prices: any[];
  };
}

// utils/listImportUtils.ts
export interface ListImportCallbacks {
  onProductMatch: (args: {
    oldProductId: number;
    newProductId: number;
  }) => void;
  onProductCreate: (args: {
    oldProductId: number;
    newProductId: number;
    name: string;
  }) => void;
}
```

---

## Out of Scope for v1.7.0
- Merging imported list into an existing list (always creates new)
- Exporting multiple lists at once
- Progress indicator during import (summary modal is sufficient)
- Undo after import
- iOS support for intent filter (different mechanism)

---

## Open Questions (resolved)
- ✅ Invoice history included in export
- ✅ Interactive fuzzy matching for products (not silent)
- ✅ Intent filter handles both list exports and full backups
- ✅ Old backups (no `type` field) detected via `data.tables + data.version + data.exportedAt + data.tables.lists`
- ✅ Export trigger lives in `ListsScreen` action sheet only (not `HomeScreen`)