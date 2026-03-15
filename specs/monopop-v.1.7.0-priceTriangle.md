# PriceTriangle — Component & Integration Spec
> Monopop v1.7.0  
> Covers: PriceTriangle component, EditShoppingItemModal redesign, unit configurator flow,
> warning system, retro dialog, handleSaveEdit, and all DB/utility changes required.
>
> Last updated: session 4 (final)

---

## 1. The constraint system

Three fields are mutually constrained given a known `standardPackageSize`:

```
pricePerUnit = pricePaid / packageSize
pricePerPackage = pricePerUnit × standardPackageSize
```

| Field | Portuguese label | Editable | Stored |
|-------|-----------------|----------|--------|
| `pricePerPackage` | "Preço por [1kg]" | Yes | No — derived live |
| `packageSize` | "Tamanho" | Yes | Yes — **atomic** (g / ml / un) |
| `pricePaid` | "Preço pago" | Yes | Yes (shopping_list_items.price) |
| `pricePerUnit` | "Preço por unidade" | **No** | No — derived live |
| `total` | "Total" | No | No — derived live |

Any two of the top three determine the third.
`quantity` (package count) multiplies `pricePaid` for `total` only — never enters the triangle constraint.

### Derivation rules

Given `std = standardPackageSize` (atomic):

```
touched: [paid, size]  → derive pricePerPackage = (paid / size) × std
touched: [pkg, size]   → derive paid = (pkg / std) × size
touched: [pkg, paid]   → derive size = (paid / pkg) × std
touched: [paid]        → if size known: derive pkg = (paid / size) × std
touched: [size]        → if paid known: derive pkg; else if pkg known: derive paid
touched: [pkg]         → if size known: derive paid
touched: []            → no derivation (seeded state — all pre-filled, none marked derived)
```

`lastTouchedRef` tracks the last **two** distinct fields edited. The field not in `lastTouchedRef` is derived. When `lastTouchedRef` is empty, no field is marked derived.

Edge case: if user edits all three sequentially, the oldest drops off. Last two always win.

### Derived field indicator

The currently-derived field receives:
- `backgroundColor: theme.colors.surfaceVariant`
- Label prefix: `≈`

Purely cosmetic — constraint logic is unchanged.

---

## 2. Unit system

### Storage
- `products.unit` stores the **display unit preference**: `'g'`, `'kg'`, `'ml'`, `'L'`, or `'un'`
- `packageSize` and `standardPackageSize` are **always stored in atomic units**:
  - `'g'` and `'kg'` → stored as **grams**
  - `'ml'` and `'L'` → stored as **millilitres**
  - `'un'` → stored as units (factor 1)

Example: user picks `kg`, types `1` → `unit='kg'`, `standardPackageSize=1000` (grams in DB).
Example: user picks `g`, types `400` → `unit='g'`, `standardPackageSize=400` (grams in DB).

`unit` tells you both what to display to the user AND the factor needed to convert the stored atomic value for display.

### Conversion factors

| unit | atomic base | factor (atomic → display) |
|------|------------|--------------------------|
| `g`  | g | 1 |
| `kg` | g | 1000 |
| `ml` | ml | 1 |
| `L`  | ml | 1000 |
| `un` | un | 1 |

Used in exactly two places:
- `PriceTriangle.getValue()` — multiply display input by factor to get atomic for storage
- `PriceTriangle.seed()` — divide atomic value by factor to get display value for inputs
- Display format functions — divide atomic by factor before formatting the number

### `utils/units.ts` — full replacement

```typescript
export type UnitSymbol = 'g' | 'kg' | 'ml' | 'L' | 'un';
export type UnitFamily = 'massa' | 'volume' | 'contagem';

export type Unit = {
  symbol: UnitSymbol;
  family: UnitFamily;
  factor: number;          // atomic value / factor = display value
  defaultStdSize: number;  // ghost default for stdSize input (in display units)
};

export const UNITS: Unit[] = [
  { symbol: 'g',  family: 'massa',    factor: 1,    defaultStdSize: 400 },
  { symbol: 'kg', family: 'massa',    factor: 1000, defaultStdSize: 1   },
  { symbol: 'ml', family: 'volume',   factor: 1,    defaultStdSize: 500 },
  { symbol: 'L',  family: 'volume',   factor: 1000, defaultStdSize: 1   },
  { symbol: 'un', family: 'contagem', factor: 1,    defaultStdSize: 12  },
];

export const UNITS_BY_FAMILY: Record<UnitFamily, Unit[]> = {
  massa:    UNITS.filter(u => u.family === 'massa'),
  volume:   UNITS.filter(u => u.family === 'volume'),
  contagem: UNITS.filter(u => u.family === 'contagem'),
};

export const getUnitFactor = (symbol: UnitSymbol): number =>
  UNITS.find(u => u.symbol === symbol)?.factor ?? 1;

export const getFamilyOf = (symbol: UnitSymbol): UnitFamily =>
  UNITS.find(u => u.symbol === symbol)!.family;

// Display atomic value in the product's chosen unit
// e.g. formatStandardPackageDisplay('kg', 1000) → '1kg'
//      formatStandardPackageDisplay('g', 400)   → '400g'
//      formatStandardPackageDisplay('kg', 500)  → '0.5kg'
export const formatStandardPackageDisplay = (
  unit: UnitSymbol,
  atomicValue: number
): string => {
  const factor = getUnitFactor(unit);
  const display = atomicValue / factor;
  const displayStr = Number.isInteger(display)
    ? String(display)
    : display.toFixed(3).replace(/\.?0+$/, '');
  return `${displayStr}${unit}`;
};

export const getPricePerPackageLabel = (
  unit: UnitSymbol | null | undefined,
  standardPackageSize: number | null | undefined  // atomic
): string => {
  if (!unit || !standardPackageSize || standardPackageSize <= 0) return 'Preço por emb. padrão';
  return `Preço por ${formatStandardPackageDisplay(unit, standardPackageSize)}`;
};

// R$ per display unit (e.g. R$/kg, R$/L, R$/un)
// pricePerAtomicUnit: R$ per gram, R$ per ml, etc.
export const formatPricePerUnitDisplay = (
  pricePerAtomicUnit: number,
  unit: UnitSymbol
): string => {
  const factor = getUnitFactor(unit);
  const pricePerDisplayUnit = pricePerAtomicUnit * factor;
  const s = pricePerDisplayUnit < 10
    ? pricePerDisplayUnit.toPrecision(4).replace(/\.?0+$/, '')
    : pricePerDisplayUnit.toFixed(2);
  return `R$ ${s.replace('.', ',')}/${unit}`;
};

// R$ per standard package
// pricePerAtomicUnit: R$ per gram/ml/un
// stdSizeAtomic: standardPackageSize in atomic units
export const formatPerStdPkg = (
  pricePerAtomicUnit: number,
  unit: UnitSymbol,
  stdSizeAtomic: number
): string => {
  const price = pricePerAtomicUnit * stdSizeAtomic;
  return `R$ ${price.toFixed(2).replace('.', ',')}/${formatStandardPackageDisplay(unit, stdSizeAtomic)}`;
};
```

Remove `UNIT_BY_SYMBOL` — replace usages with `UNITS.find(u => u.symbol === x)`.
Move `formatPricePerUnitDisplay` and `formatPerStdPkg` from `EditShoppingItemModal` to here.

### Unit picker — pre-selection for existing products

When the configurator opens for a product with `unit` already set:
- Find `UNITS.find(u => u.symbol === productUnit)` → this is the pre-selected unit chip
- Pre-select the family from that unit's `family` field
- Pre-fill stdSize input with `productStandardPackageSize / factor` (display value)

No inference needed. Read unit from DB, find matching Unit entry, done.

---

## 3. DB additions

### New function: `getLowestRefPricesPerUnit`

Returns the lowest price-per-atomic-unit across all store ref rows for unit-configured products only.

```typescript
export const getLowestRefPricesPerUnit = async (
  productIds: number[]
): Promise<Map<number, { pricePerUnit: number; storeName: string }>> => {
  if (productIds.length === 0) return new Map();
  const db = getDb();
  const placeholders = productIds.map(() => '?').join(',');

  const rows = await db.getAllAsync<{
    productId: number;
    price: number;
    packageSize: number;
    storeName: string;
  }>(
    `SELECT psp.productId, psp.price, psp.packageSize, s.name as storeName
     FROM product_store_prices psp
     JOIN products p ON psp.productId = p.id
     LEFT JOIN stores s ON psp.storeId = s.id
     WHERE psp.productId IN (${placeholders})
       AND p.unit IS NOT NULL
       AND psp.packageSize IS NOT NULL
       AND psp.packageSize > 0
     ORDER BY psp.productId, (psp.price / psp.packageSize) ASC;`,
    productIds
  );

  const result = new Map<number, { pricePerUnit: number; storeName: string }>();
  for (const row of rows) {
    if (!result.has(row.productId)) {
      // price and packageSize are both atomic → ratio is R$ per atomic unit
      result.set(row.productId, {
        pricePerUnit: row.price / row.packageSize,
        storeName: row.storeName,
      });
    }
  }
  return result;
};
```

### `getShoppingListItemsByListId` query

Must return `p.unit` alongside existing fields. Confirm the query joins `products` and add `p.unit AS productUnit` to the SELECT. This feeds `productUnit` into `ShoppingListItemWithDetails`.

### `ShoppingListItemWithDetails` — new fields

```typescript
productUnit: string | null;
lowestRefPricePerUnit: { pricePerUnit: number; storeName: string } | null;
```

### `loadPricesAsync` — updated

Split productIds by unit configuration, skip `getLowestPriceForProducts` for unit products:

```typescript
const unitProductIds = items
  .filter(i => i.productUnit != null)
  .map(i => i.productId)
  .filter(id => id > 0);

const legacyProductIds = items
  .filter(i => i.productUnit == null)
  .map(i => i.productId)
  .filter(id => id > 0);

const [lowestLegacyMap, refMap, lowestRefMap] = await Promise.all([
  getLowestPriceForProducts(legacyProductIds),
  getReferencePricesForProducts(productIds, storeId),
  getLowestRefPricesPerUnit(unitProductIds),
]);
```

Populate `lowestPrice90d` from `lowestLegacyMap` (unit products get `null`).
Populate `lowestRefPricePerUnit` from `lowestRefMap` (legacy products get `null`).

---

## 4. `ShoppingListItemCard` — warning condition

`ShoppingListItemCard` receives `showWarning: boolean` from parent. No raw price fields needed on the card for warning logic.

Warning computation in `renderRow` (ShoppingListScreen):

```typescript
const showWarning = item.productUnit != null
  ? !!(
      item.lowestRefPricePerUnit &&
      item.refPrice?.packageSize &&
      item.refPrice.packageSize > 0 &&
      (item.refPrice.price / item.refPrice.packageSize) >
        item.lowestRefPricePerUnit.pricePerUnit
    )
  : !!(
      item.price &&
      item.lowestPrice90d &&
      item.price > item.lowestPrice90d.price
    );
```

`ShoppingListItemCard` interface: replace inline `lowestPrice90d` comparison with `showWarning: boolean` prop.

---

## 5. `PriceTriangle` component

**File:** `src/components/PriceTriangle.tsx`

### Ref handle

```typescript
export interface TriangleValue {
  pricePaid: number | undefined;
  packageSize: number | null;       // atomic (grams / ml / un)
  updateRefPrice: boolean;
  updateStdSize: boolean;
  unitConfigData: {
    unit: UnitSymbol;               // display unit chosen (e.g. 'kg')
    newStandardPackageSize: number; // atomic (e.g. 1000 for 1kg)
  } | null;
}

export interface PriceTriangleHandle {
  getValue: () => TriangleValue;
  seed: (data: SeedData) => void;
  reset: () => void;
}

export interface SeedData {
  pricePerPkg: number;          // R$ for one standard package
  packageSize: number;          // atomic
  pricePaid: number;            // R$
  unit: UnitSymbol;
  standardPackageSize: number;  // atomic
}
```

### Props

```typescript
interface PriceTriangleProps {
  productUnit: UnitSymbol | null;
  productStandardPackageSize: number | null;  // atomic
  refPrice?: RefPrice | null;
  manualOverrideActive?: boolean;
  initialPrice?: number;
  initialPackageSize?: number | null;         // atomic
  quantity: number;
  onQuantityChange: (q: number) => void;
  lowestRefPricePerUnit?: { pricePerUnit: number; storeName: string } | null;
  selectedStoreName?: string | null;
  onUnitConfigured?: () => void;  // called when inline setup completes, for parent state
}
```

### Internal state

```typescript
// Triangle refs — mutated without re-render
const pricePerPkgRef = useRef(0);   // cents, in display units
const packageSizeRef = useRef(0);   // in display units (atomic / factor)
const pricePaidRef = useRef(0);     // cents
const lastTouchedRef = useRef<('pkg' | 'size' | 'paid')[]>([]);

// Render state + forced-remount keys
const [pricePerPkgCents, setPricePerPkgCents] = useState(0);
const [pricePerPkgKey, setPricePerPkgKey] = useState(0);
const [packageSizeStr, setPackageSizeStr] = useState('');
const [pricePaidCents, setPricePaidCents] = useState(0);
const [pricePaidKey, setPricePaidKey] = useState(0);

// Active unit — resolved from productUnit prop or chosen in setup
const activeUnit: Unit | null = productUnit
  ? UNITS.find(u => u.symbol === productUnit) ?? null
  : confirmedConfig
    ? UNITS.find(u => u.symbol === confirmedConfig.unit) ?? null
    : null;

// Unit configurator (setup mode only)
const [selectedFamily, setSelectedFamily] = useState<UnitFamily | null>(null);
const [selectedUnitSymbol, setSelectedUnitSymbol] = useState<UnitSymbol | null>(null);
const [stdSizeInputStr, setStdSizeInputStr] = useState('');
const [confirmedConfig, setConfirmedConfig] = useState<{
  unit: UnitSymbol;
  atomicStdSize: number;
} | null>(null);

// familyOf — inline only, not exported:
// { g: 'massa', kg: 'massa', ml: 'volume', L: 'volume', un: 'contagem' }[symbol]

// Effective stdSize for triangle math
const effectiveAtomicStdSize = productStandardPackageSize ?? confirmedConfig?.atomicStdSize ?? null;
const factor = activeUnit?.factor ?? 1;
const displayStdSize = effectiveAtomicStdSize != null ? effectiveAtomicStdSize / factor : null;

// Options
const [updateRefPrice, setUpdateRefPrice] = useState(true);
const [updateStdSize, setUpdateStdSize] = useState(false);
```

### `getValue()` — display → atomic

```typescript
getValue(): TriangleValue {
  const pricePaid = pricePaidRef.current > 0 ? pricePaidRef.current / 100 : undefined;
  const atomicPackageSize = packageSizeRef.current > 0
    ? packageSizeRef.current * factor   // display → atomic
    : null;

  return {
    pricePaid,
    packageSize: atomicPackageSize,
    updateRefPrice,
    updateStdSize,
    unitConfigData: confirmedConfig ?? null,
  };
}
```

### `seed()` — atomic → display

```typescript
seed(data: SeedData): void {
  const unit = UNITS.find(u => u.symbol === data.unit)!;
  const f = unit.factor;

  const displayPkgSize = data.packageSize / f;
  const displayStdSize = data.standardPackageSize / f;
  const pricePerDisplayUnit = data.pricePerPkg / displayStdSize;  // R$/display-unit
  const displayPricePerPkg = pricePerDisplayUnit * displayStdSize; // = data.pricePerPkg

  pricePerPkgRef.current = Math.round(data.pricePerPkg * 100);
  packageSizeRef.current = displayPkgSize;
  pricePaidRef.current = Math.round(data.pricePaid * 100);

  setPricePerPkgCents(pricePerPkgRef.current);
  setPricePerPkgKey(k => k + 1);
  setPackageSizeStr(String(displayPkgSize));
  setPricePaidCents(pricePaidRef.current);
  setPricePaidKey(k => k + 1);
  lastTouchedRef.current = [];
}
```

### `reset()`

```typescript
reset(): void {
  pricePerPkgRef.current = 0;
  packageSizeRef.current = 0;
  pricePaidRef.current = 0;
  setPricePerPkgCents(0);
  setPricePerPkgKey(k => k + 1);
  setPackageSizeStr('');
  setPricePaidCents(0);
  setPricePaidKey(k => k + 1);
  lastTouchedRef.current = [];
}
```

### Derivation — unchanged logic, display units throughout

`deriveThird` receives `displayStdSize` (not atomic). All internal arithmetic is in display units. Atomic conversion only happens in `getValue()` and `seed()`.

### Warning comparison — back to atomic for cross-store comparison

```typescript
// currentPPU must be atomic to compare with lowestRefPricePerUnit (which is also atomic)
const currentAtomicPPU = (pricePaidRef.current / 100) / (packageSizeRef.current * factor);
const showWarning = !!(
  lowestRefPricePerUnit &&
  pricePaidRef.current > 0 &&
  packageSizeRef.current > 0 &&
  currentAtomicPPU > lowestRefPricePerUnit.pricePerUnit
);
```

### Layout — configured mode

```
┌─────────────────────────────────────────────────┐
│  ≈PREÇO POR 1KG        TAMANHO                  │  top row, 50/50
│  [ R$ 35,90     ]      [ 0,67   ] kg            │
│                                                  │
│  PREÇO PAGO                        QTD           │  bottom row, 75/25
│  [ R$ 24,05              ]     [−][1][+]         │
│                                                  │
│ ┌───────────────────────────────────────────┐    │
│ │ R$35,90/kg  ·  R$35,90/1kg              │    │  surfaceVariant bg
│ │ Total: R$24,05                           │    │
│ │ ⚠ Mín. ref: R$33,20/kg em Atacadão      │    │  only if showWarning
│ └───────────────────────────────────────────┘    │
│                                                  │
│ ☑ Salvar referência em Mercadão                 │
│ ☐ Atualizar emb. padrão para 0,67kg            │  only if pkgSize ≠ stdSize
│   Preço não será salvo como referência          │  hint when ref unchecked
└─────────────────────────────────────────────────┘
```

- `PREÇO PAGO`: font 18, full width, auto-focused on modal open
- `TAMANHO` input: shows display value (e.g. `0,67` for 670g with unit=kg)
- `PREÇO POR 1KG` label: `getPricePerPackageLabel(productUnit, atomicStdSize)`
- Derived info row: `formatPricePerUnitDisplay(atomicPPU, unit)` · `formatPerStdPkg(atomicPPU, unit, atomicStdSize)`

### Checkbox labels — contextual

| Condition | Label |
|-----------|-------|
| Store selected, no manual override | "Salvar referência em [StoreName]" |
| Store selected, manual override active | "Substituir ajuste manual e salvar em [StoreName]" |
| No store | "Salvar como preço base" |

Hint when ref unchecked:
- Manual override → `"Preço não será salvo — ajuste manual mantido"`
- Otherwise → `"Preço não será salvo como referência"`

`updateStdSize` checkbox: visible only when `atomicPackageSize ≠ atomicStdSize` AND `confirmedConfig === null`.

### Layout — setup mode

```
Como medir este produto?

[ Peso ]    [ Volume ]    [ Contagem ]

── after tapping Peso ──────────────────────────────

[✓ Peso ]   [ Volume ]   [ Contagem ]

   [ g ]   [ kg ]        ← UNITS_BY_FAMILY['massa']

── after tapping kg ────────────────────────────────

Embalagem padrão:
[ 1            ] kg  [✓]
                     ↑ enabled immediately
                     ↑ empty input → commits defaultStdSize (1 for kg)
                     ↑ typed input → commits parseFloat(input) * factor (atomic)
```

On confirm:
```typescript
const displayInput = parseFloat(stdSizeInputStr) || selectedUnit.defaultStdSize;
const atomicStdSize = displayInput * selectedUnit.factor;
setConfirmedConfig({ unit: selectedUnitSymbol, atomicStdSize });
onUnitConfigured?.();
// seed triangle with atomicStdSize and existing initialPrice/initialPackageSize
```

Badge after confirm:
```
✓ kg · emb. padrão 1kg   [editar]
```
`[editar]` → clears `confirmedConfig` only, returns to family picker. No DB change until Save.

---

## 6. `EditShoppingItemModal` — redesign

### Main content states

```typescript
const isUnitConfigured = !!productUnit;
const [inlineSetupDone, setInlineSetupDone] = useState(false);
const [setupStarted, setSetupStarted] = useState(false);

const showTriangle = isUnitConfigured || inlineSetupDone;
const showSetup = !isUnitConfigured && setupStarted && !inlineSetupDone;
const showLegacy = !showTriangle && !showSetup;
```

**State A (showLegacy):**
- Quantity stepper + pricePaid side by side
- Total preview
- Button: `"Configurar unidade"` → `setSetupStarted(true)`
- Subtitle: `"Ative comparação por g, kg, L…"`

**State B (showTriangle):**
- `<PriceTriangle ref={triangleRef} ... onUnitConfigured={() => setInlineSetupDone(true)} />`
- Auto-focuses pricePaid on mount

**State C (showSetup):**
- `<PriceTriangle ref={triangleRef} ... onUnitConfigured={() => setInlineSetupDone(true)} />`
- In setup mode until stdSize confirmed, then transitions to State B automatically

### Context row — simplified

Right side: `showWarning` boolean prop from parent, renders ⚠ icon only. No text.
Left side: inventory quantity. Unchanged.
Remove: duplicate warning text below pricePaid in State A.

### `handleSave` — simplified

```typescript
const handleSave = () => {
  // Intentional: Save commits cart state changes made during this session.
  // If user toggled checked state and taps Save, the toggle is preserved.
  if (checked !== item?.checked) onToggleChecked();

  if (showTriangle) {
    const value = triangleRef.current?.getValue();
    onSave(quantity, value?.pricePaid, {
      packageSize: value?.packageSize ?? null,
      updateReferencePrice: value?.updateRefPrice ?? true,
      updateStandardPackageSize: value?.updateStdSize ?? false,
      unit: value?.unitConfigData?.unit ?? null,
      newStandardPackageSize: value?.unitConfigData?.newStandardPackageSize ?? null,
    });
  } else {
    const price = priceCentsRef.current > 0 ? priceCentsRef.current / 100 : undefined;
    onSave(quantity, price);
  }
};
```

### Removed from `EditShoppingItemModal`

All triangle refs, all triangle state, `deriveThird`, `touchField`, `resetTriangle`, all three triangle change handlers, all inline unit config state, `prevHasUnit` ref and its effect, `updateRefPrice`/`updateStdSize` state, `hasUnit`/`unitConfiguredInline`/`effectiveUnit`/`effectiveStdSize` derivations, `refreshEditingItem` call.

---

## 7. `handleSaveEdit` — changes in `ShoppingListScreen`

- Remove `refreshEditingItem()` call after `loadData()` — confirmed no-op
- Remove `promptForRetroPackageSize` from `useCallback` deps — wired via `retroPromptRef`
- All other logic unchanged

---

## 8. Retro dialog improvements

### Alert variants

**With last purchase:**
```
Title: "Calcular referência histórica?"
Body:  "Última compra encontrada:
        • Loja: [StoreName]
        • Data: [DateTime]
        • Preço: R$14,00
        
        Quer usar essa compra para calcular o preço por
        unidade? Você só precisa confirmar o tamanho
        da embalagem."

Buttons: [Não salvar unidade]   [Não]   [Sim]
```

**Without last purchase:**
```
Title: "Configurar unidade"
Body:  "Nenhuma compra anterior encontrada.
        As referências de preço existentes serão removidas
        para evitar inconsistências."

Buttons: [Cancelar]   [Confirmar]
```

"Não salvar unidade" / "Cancelar" → unit not saved.
"Confirmar" (no purchase) → save unit + clear refs (same as "Não" in with-purchase).

### Dialog.Content layout

```
Confirme o tamanho da embalagem

┌──────────────────────────────────┐
│ 🏪 Mercadão   📅 12/03/2025    │  surfaceVariant, borderRadius 8
│ R$ 14,00                        │
└──────────────────────────────────┘

[ 400            ] g
```

Input pre-filled with `standardPackageSize / factor` (display value).
Confirm button enabled immediately.

---

## 9. Warning system summary

| Product type | Source | Condition |
|-------------|--------|-----------|
| Unit-configured | `getLowestRefPricesPerUnit` | `currentAtomicPPU > lowestRefPricePerUnit.pricePerUnit` |
| Legacy | `getLowestPriceForProducts` | `currentPrice > lowestPrice90d.price` |

`getLowestPriceForProducts` called only for `legacyProductIds`. Skipped for unit products.

Triangle warning line: `⚠ Mín. ref: R$33,20/kg em Atacadão` using `formatPricePerUnitDisplay(lowestRefPricePerUnit.pricePerUnit, productUnit)`.

---

## 10. Implementation order

1. `utils/units.ts` — replace `UnitSymbol`, `UNITS`, add `UNITS_BY_FAMILY`, `getUnitFactor`, `getFamilyOf`, update format functions, add `formatPricePerUnitDisplay` and `formatPerStdPkg`
2. `database.ts` — add `getLowestRefPricesPerUnit`
3. `getShoppingListItemsByListId` — confirm `p.unit` is returned as `productUnit`
4. `ShoppingListItemWithDetails` — add `productUnit`, `lowestRefPricePerUnit`
5. `loadPricesAsync` — split productIds, three batch calls, populate new fields
6. `ShoppingListItemCard` — replace `lowestPrice90d` comparison with `showWarning: boolean` prop
7. `renderRow` — compute `showWarning`, pass it to card
8. `PriceTriangle.tsx` — new component
9. `EditShoppingItemModal` — remove inline triangle, wire PriceTriangle, State A/B/C, retro dialog improvements
10. `handleSaveEdit` — remove dead call, fix deps
11. Smoke test: legacy → configure inline → save; unit product fast entry; retro with/without history

---

## 11. Not changing

- `UnitSaveData` interface
- `concludeShoppingForListWithInvoiceV2`
- `computeInventoryIncrement`
- `clearReferencePricesForProduct`
- `handleSaveEdit` logic
- Second Portal pattern for retro dialog
- Cart toggle on Save (intentional, documented in code)

---

## 12. Deferred to v1.8.0

- `invoice_items.packageSize` in lowest-price queries
- Cross-product comparison
- Per-store observed shelf price
- Barcode scanning / product variants