# EditInventoryItem — Redesign Spec
> Monopop v1.7.0
> Covers: layout redesign, PriceTriangle integration, unit management,
> useRetroPrompt hook, stats improvements, breaking fixes.
>
> Last updated: session 5 (final)

---

## 1. Breaking fixes

### `getReferencePriceForProduct` return type

Now returns `RefPrice | null` instead of `number | null`.

**`loadAll`:**
```typescript
const refPrice = await getReferencePriceForProduct(inventoryItem.productId, initialStoreId);
setCurrentRefPrice(refPrice);
if (refPrice) {
  setSuggestedPrice(refPrice.price);
  setPriceInput(refPrice.price.toFixed(2));
}
```

**`handleStoreSelect`:**
```typescript
const refPrice = await getReferencePriceForProduct(inventoryItem.productId, storeId);
setCurrentRefPrice(refPrice);
setSuggestedPrice(refPrice?.price ?? 0);
setPriceInput(refPrice ? refPrice.price.toFixed(2) : '');
```

### `upsertProductStorePrice` / `upsertProductBasePrice` packageSize param

All call sites in `handleSave` pass `packageSize`:
```typescript
await upsertProductStorePrice(productId, storeId, price, packageSize ?? null);
await upsertProductBasePrice(productId, price, packageSize ?? null);
```

---

## 2. `useRetroPrompt` hook

**File:** `src/hooks/useRetroPrompt.tsx`

Extracts the retro package size dialog from `EditShoppingItemModal` for reuse
in `EditInventoryItem`.

**Signature:**
```typescript
export function useRetroPrompt(): {
  promptForRetroPackageSize: (
    prefill: number,    // atomic value
    unit: string,
    invoiceInfo: { storeName: string; createdAt: string; unitPrice: number } | null
  ) => Promise<number | null>;  // resolves with atomic value or null
  retroDialogElement: React.ReactElement;
}
```

**Internal state:** `retroVisible`, `retroPackageSizeText`, `retroUnit`,
`retroInvoiceInfo`, `retroResolveRef`. All moved from `EditShoppingItemModal`.

**`promptForRetroPackageSize`:**
- Converts atomic `prefill` to display value using `getUnitFactor`
- Shows dialog
- On confirm: parses input, converts display → atomic (`v * factor`), resolves
- On cancel/dismiss: resolves with null

**Dialog variants:**
- With invoice info: shows invoice card (store, date, price), input pre-filled
- Without invoice info: simplified message, input still shown

**`retroDialogElement`:** the Dialog JSX. Caller renders it inside a Portal.
For `EditShoppingItemModal`, it goes in the existing second Portal.
For `EditInventoryItem`, it goes in a new Portal at the end of the screen.

**Migration of `EditShoppingItemModal`:**
- Remove all inline retro state and Dialog JSX
- Import `useRetroPrompt`
- Replace `promptForRetroPackageSize` with the hook's version
- Wire `promptRef.current = promptForRetroPackageSize` in the existing `useEffect`
- Render `retroDialogElement` in the second Portal

---

## 3. `getProductConsumptionStats` — unit-aware additions

Add two optional fields to the return type:

```typescript
{
  avgWeeklyConsumption: number | null;
  avgPrice90d: number | null;
  lowestPrice90d: { price: number; storeName: string } | null;
  // New:
  avgPricePerUnit90d: number | null;    // null when no packageSize data available
  lowestPricePerUnit90d: { pricePerUnit: number; storeName: string } | null;
}
```

Implementation: two additional db.getFirstAsync calls added inside
getProductConsumptionStats, not combined with the existing query.
The existing query structure is kept unchanged.

```sql
-- avgPricePerUnit90d
SELECT AVG(ii.unitPrice / ii.packageSize) as avgPPU
FROM invoice_items ii
JOIN invoices inv ON ii.invoiceId = inv.id
WHERE ii.productId = ?
  AND ii.unitPrice IS NOT NULL AND ii.unitPrice > 0
  AND ii.packageSize IS NOT NULL AND ii.packageSize > 0
  AND inv.createdAt >= ?

-- lowestPricePerUnit90d
SELECT ii.unitPrice / ii.packageSize as ppu, s.name as storeName
FROM invoice_items ii
JOIN invoices inv ON ii.invoiceId = inv.id
LEFT JOIN stores s ON inv.storeId = s.id
WHERE ii.productId = ?
  AND ii.unitPrice IS NOT NULL AND ii.unitPrice > 0
  AND ii.packageSize IS NOT NULL AND ii.packageSize > 0
  AND inv.createdAt >= ?
ORDER BY ppu ASC
LIMIT 1
```

**Display rule:**
- Unit configured AND PPU data available → show `formatPerStdPkg(ppu, unit, stdSize)`
- Otherwise → show nominal `formatCurrency(price)` as fallback

The `getLowestRefPricesPerUnit` call is separate (cross-store ref prices, not 90d
invoice history). Both are loaded in `loadAll` and shown in stats.

---

## 4. Layout

### Visual approach

Minimal section breaks. Two levels:
- **Primary break:** subtle `Divider` + spacing (12px top margin)
- **Section label:** small uppercase text, only where genuinely needed
  (`PRODUTO`, `PREÇO DE REFERÊNCIA`)

No accent bars on every section. Screen real estate used for content, not chrome.

### Full layout sketch

```
[ContextualHeader: list name | delete]

ScrollView padding: 16

── Name ──────────────────────────────────────────
[ProductName text]          [✏ icon]  [🗑 icon]

── Quantity + unit ───────────────────────────────
[ − ]  [ 3 ]  [ + ]     kg · 1kg  [✏ editar]
                         OR
                         [+ Configurar unidade]

[Observações... text input, multiline]   ← inline, no header

── Unit editor (inline expand, when open) ────────
[Peso] [Volume] [Contagem]
[g] [kg]
Embalagem padrão: [ 1 ] kg [✓]
[Remover unidade]   ← only when editing existing

Divider

PRODUTO
[Categoria chip]  [Lista chip]   ← small label above chips

Divider

PREÇO DE REFERÊNCIA
[StoreSelector]

<PriceTriangle showQuantity={true} />   ← when unit configured
  (QTD stepper here for SL quantity)
OR
[simple price field]                    ← when legacy

[🛒 Adicionar à lista]  OR  [✓ Na lista (2)]  [×]
                              ← below triangle / price field

[Salvar alterações]

Divider

ESTATÍSTICAS  [∨]             ← collapsible, default collapsed
[stats rows]

Divider

HISTÓRICO DE QUANTIDADE  [∨]  ← collapsible
HISTÓRICO DE PREÇOS  [∨]      ← collapsible
```

### Key layout decisions

**Quantity + unit on one row:**
```
[ − ]  [ 3 ]  [ + ]     kg · 1kg  [✏]
```
The unit chip/button in the same row as the stepper. Saves a full row.
Unit editor expands inline below this row when tapped.

**Notes inline:** no header, just a multiline text input below the qty row.
Placeholder: "Observações...". Keeps related operational data together.

**Category + list:** single `PRODUTO` label above both chips. No separate headers
for each. Chips remain pressable to open pickers.

**Shopping list — no dedicated section:**
A single row at the bottom of the price area:
- Not on list: `[🛒 Adicionar à lista]` button (outlined, full width or half)
- On list: `[✓ Na lista · 2 embalagens]  [×]`
  The quantity shown is `PriceTriangle.getValue().packageSize ?? 1` when unit
  configured, or 1 for legacy. Tapping [×] removes from list.
  Tapping the row when on list opens quantity edit (inline stepper or just uses
  the triangle's QTD).

**PriceTriangle QTD for SL:** keep `showQuantity={true}`. The QTD stepper in the
triangle drives the shopping list quantity. The SL button reads from triangle
`getValue()` at tap time. This means the user sets price + qty in the triangle,
taps add, done.

---

## 5. Unit management

### State

```typescript
const [unitExpanded, setUnitExpanded] = useState(false);
const [localUnit, setLocalUnit] = useState<UnitSymbol | null>(
  inventoryItem?.unit ?? null
);
const [localStdSizeStr, setLocalStdSizeStr] = useState<string>(
  inventoryItem?.unit && inventoryItem?.standardPackageSize
    ? String(inventoryItem.standardPackageSize / getUnitFactor(inventoryItem.unit))
    : ''
);
// selectedUnitSymbol and selectedFamily for the picker (same as modal)
const [selectedFamily, setSelectedFamily] = useState<UnitFamily | null>(
  inventoryItem?.unit ? getFamilyOf(inventoryItem.unit) : null
);
const [selectedUnitSymbol, setSelectedUnitSymbol] = useState<UnitSymbol | null>(
  inventoryItem?.unit ?? null
);
```

**Effective atomic stdSize** (read from local state, not inventoryItem):
```typescript
const selectedUnitObj = selectedUnitSymbol
  ? UNITS.find(u => u.symbol === selectedUnitSymbol) ?? null
  : null;
const displayStdSizeVal = parseFloat(localStdSizeStr) || selectedUnitObj?.defaultStdSize || 0;
const effectiveAtomicStdSize = selectedUnitObj && displayStdSizeVal > 0
  ? displayStdSizeVal * selectedUnitObj.factor
  : null;
```

### Unit chip / button row

```typescript
// In the qty row, right side:
{localUnit && effectiveAtomicStdSize ? (
  <Pressable onPress={() => setUnitExpanded(e => !e)}>
    <Text>{formatStandardPackageDisplay(localUnit, effectiveAtomicStdSize)}</Text>
    <MaterialCommunityIcons name={unitExpanded ? 'chevron-up' : 'chevron-down'} />
  </Pressable>
) : (
  <Pressable onPress={() => setUnitExpanded(true)}>
    <Text>+ Configurar unidade</Text>
  </Pressable>
)}
```

### Inline unit editor (when `unitExpanded`)

Renders below the qty row. Same family → unit → stdSize flow as modal.
Pre-selects current values when editing existing unit.

**Additional elements not in modal:**

"Remover unidade" link — only shown when `inventoryItem.unit` is already set:
```typescript
{inventoryItem?.unit && (
  <Pressable onPress={handleRemoveUnit}>
    <Text style={{ color: theme.colors.error }}>Remover unidade</Text>
  </Pressable>
)}
```

`handleRemoveUnit`:
```typescript
Alert.alert(
  'Remover unidade?',
  'As referências de preço existentes serão removidas.',
  [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: () => {
      setLocalUnit(null);
      setLocalStdSizeStr('');
      setSelectedFamily(null);
      setSelectedUnitSymbol(null);
      setUnitExpanded(false);
      isDirtyRef.current = true;
    }},
  ]
);
```

Actual DB operations (`updateProductUnit(null, null)` + `clearReferencePricesForProduct`)
happen in `handleSave`.

### Confirm stdSize button

Same ghost default: empty input commits `selectedUnitObj.defaultStdSize`.
On confirm → sets `localUnit = selectedUnitSymbol`, `localStdSizeStr = input`,
collapses editor (`setUnitExpanded(false)`), marks dirty.

No immediate DB writes. All deferred to `handleSave`.

---

## 6. `handleSave` — unit change + retro flow

Unit changes are batched with everything else. The retro prompt fires during save
if unit was changed for the first time.

```typescript
const handleSave = useCallback(async () => {
  if (!inventoryItem?.id) return;
  try {
    // Core inventory update
    await updateInventoryItem(inventoryItem.id, liveQuantity, notes);

    if (name !== inventoryItem.productName) {
      await updateProductName(inventoryItem.productId, name);
    }
    if (selectedCategoryId !== (inventoryItem.categoryId ?? null)) {
      await updateProductCategory(inventoryItem.productId, selectedCategoryId!);
    }
    if (selectedListId !== inventoryItem.listId) {
      await updateInventoryItemList(inventoryItem.id, selectedListId);
    }

// Unit changes — all DB writes deferred until AFTER alert choice
const unitChanged = localUnit !== inventoryItem.unit ||
  effectiveAtomicStdSize !== inventoryItem.standardPackageSize;

if (!localUnit && inventoryItem.unit) {
  // Removing unit — no alert needed, confirmed via handleRemoveUnit already
  await updateProductUnit(inventoryItem.productId, null, null);
  await clearReferencePricesForProduct(inventoryItem.productId);

} else if (unitChanged && localUnit && effectiveAtomicStdSize) {
  const last = await getLastInvoiceItemForProduct(inventoryItem.productId);

  if (last) {
    const choice = await new Promise<'cancel' | 'no' | 'yes'>(resolve => {
      Alert.alert(
        'Calcular referência histórica?',
        `Última compra:\n• ${last.storeName}\n• ${formatDateTime(last.createdAt)}\n• ${formatCurrency(last.unitPrice)}\n\nUsar para calcular referência histórica?`,
        [
          { text: 'Não salvar unidade', style: 'cancel', onPress: () => resolve('cancel') },
          { text: 'Não', onPress: () => resolve('no') },
          { text: 'Sim', onPress: () => resolve('yes') },
        ]
      );
    });

    if (choice === 'cancel') {
      // Revert local state only — nothing was written to DB
      setLocalUnit(inventoryItem.unit ?? null);
      setSelectedUnitSymbol(inventoryItem.unit ?? null);
      setSelectedFamily(inventoryItem.unit ? getFamilyOf(inventoryItem.unit) : null);
      setStdSizeInputStr(
        inventoryItem.unit && inventoryItem.standardPackageSize
          ? String(inventoryItem.standardPackageSize / getUnitFactor(inventoryItem.unit))
          : ''
      );
      isDirtyRef.current = false;
      return;
    }

    // Write unit + clear refs only after confirmed
    await updateProductUnit(inventoryItem.productId, localUnit, effectiveAtomicStdSize);
    await clearReferencePricesForProduct(inventoryItem.productId);

    if (choice === 'yes') {
      const enteredSize = await promptForRetroPackageSize(
        effectiveAtomicStdSize,
        localUnit,
        { storeName: last.storeName, createdAt: last.createdAt, unitPrice: last.unitPrice }
      );
      if (enteredSize != null && enteredSize > 0) {
        await upsertProductStorePrice(inventoryItem.productId, last.storeId, last.unitPrice, enteredSize);
        await upsertProductBasePrice(inventoryItem.productId, last.unitPrice, enteredSize);
        Alert.alert(
          'Referência criada',
          `${last.storeName} • ${formatDateTime(last.createdAt)}\nPreço: ${formatCurrency(last.unitPrice)}\nTamanho: ${String(enteredSize / getUnitFactor(localUnit)).replace('.', ',')} ${localUnit}`,
        );
      }
    }
    // 'no' → unit saved, refs cleared, no retro

  } else {
    // No purchase history
    const confirmed = await new Promise<boolean>(resolve => {
      Alert.alert(
        'Configurar unidade',
        'Nenhuma compra anterior encontrada. As referências de preço existentes serão removidas.',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirmar', onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) {
      setLocalUnit(inventoryItem.unit ?? null);
      setSelectedUnitSymbol(inventoryItem.unit ?? null);
      isDirtyRef.current = false;
      return;
    }
    // Write only after confirmed
    await updateProductUnit(inventoryItem.productId, localUnit, effectiveAtomicStdSize);
    await clearReferencePricesForProduct(inventoryItem.productId);
  }
}

    // Price — triangle path
    if (localUnit && triangleRef.current) {
      const value = triangleRef.current.getValue();
      if (value.updateRefPrice && value.pricePaid && value.pricePaid > 0) {
        const pkgSize = value.packageSize ?? effectiveAtomicStdSize ?? null;
        if (selectedStoreId !== null) {
          await upsertProductStorePrice(inventoryItem.productId, selectedStoreId, value.pricePaid, pkgSize);
        } else {
          await upsertProductBasePrice(inventoryItem.productId, value.pricePaid, pkgSize);
        }
      }
      if (value.updateStdSize && value.packageSize != null) {
        await updateProductUnit(inventoryItem.productId, localUnit, value.packageSize);
      }
    } else if (!localUnit) {
      // Legacy price path
      const resolvedPrice = parseFloat(priceInput.replace(',', '.'));
      const finalPrice = isNaN(resolvedPrice) ? suggestedPrice : resolvedPrice;
      if (finalPrice > 0) {
        if (selectedStoreId !== null) {
          await upsertProductStorePrice(inventoryItem.productId, selectedStoreId, finalPrice, null);
        } else {
          await upsertProductBasePrice(inventoryItem.productId, finalPrice, null);
        }
      }
    }

    // Shopping list
    const originalSli = initialShoppingListItemRef.current;
    if (shoppingListItem?.id && shoppingListItem.id > 0) {
      await updateShoppingListItem(shoppingListItem.id, {
        quantity: shoppingListItem.quantity,
        price: localUnit && triangleRef.current
          ? triangleRef.current.getValue().pricePaid
          : suggestedPrice || undefined,
      });
    }
    if (shoppingListItem === null && originalSli) {
      await deleteShoppingListItem(originalSli.id);
    }
    if (shoppingListItem?.id === -1 && !originalSli) {
      const qty = localUnit && triangleRef.current
        ? triangleRef.current.getValue().packageSize ?? 1
        : 1;
      const price = localUnit && triangleRef.current
        ? triangleRef.current.getValue().pricePaid
        : suggestedPrice || undefined;
      await addShoppingListItem(inventoryItem.listId, inventoryItem.productName, qty, price);
    }

    isDirtyRef.current = false;
  } catch (error) {
    console.error('Erro ao salvar:', error);
  }
}, [
  inventoryItem, liveQuantity, notes, name, selectedCategoryId, selectedListId,
  localUnit, effectiveAtomicStdSize, priceInput, suggestedPrice, shoppingListItem,
  selectedStoreId, promptForRetroPackageSize,
]);
```

---

## 7. `loadAll` additions

New state variables:
```typescript
const triangleRef = useRef<PriceTriangleHandle>(null);
const [currentRefPrice, setCurrentRefPrice] = useState<RefPrice | null>(null);
const [lowestRefPricePerUnit, setLowestRefPricePerUnit] = useState<{
  pricePerUnit: number; storeName: string;
} | null>(null);
```

New calls after existing `Promise.all`:
```typescript
const refPrice = await getReferencePriceForProduct(inventoryItem.productId, initialStoreId);
setCurrentRefPrice(refPrice);
if (refPrice) {
  setSuggestedPrice(refPrice.price);
  setPriceInput(refPrice.price.toFixed(2));
}

const lowestRefMap = await getLowestRefPricesPerUnit([inventoryItem.productId]);
setLowestRefPricePerUnit(lowestRefMap.get(inventoryItem.productId) ?? null);
```

Note: `consumptionStats` now returns `avgPricePerUnit90d` and
`lowestPricePerUnit90d` — destructure these alongside existing fields.

---

## 8. Stats section

Collapsible, default collapsed. Rows:

```
Consumo médio:        ~2.1/semana

── if unit configured AND PPU data available ──
Preço médio (90d):    R$14,00/400g       ← formatPerStdPkg(avgPPU, unit, stdSize)
Menor preço (90d):    R$13,50/400g       ← formatPerStdPkg(lowestPPU, unit, stdSize)
                      em Mercadão
Menor ref. (lojas):   R$12,80/400g       ← lowestRefPricePerUnit, same format
                      em Atacadão

── if legacy OR no PPU data ──
Preço médio (90d):    R$14,00            ← formatCurrency(avgPrice90d)
Menor preço (90d):    R$13,50            ← formatCurrency(lowestPrice90d.price)
                      em Mercadão
```

`lowestRefPricePerUnit` (cross-store ref) and `lowestPricePerUnit90d` (invoice
history) are different data points — show both when available.

---

## 9. `PriceTriangle` — no `showQuantity` prop

No changes to PriceTriangle props. QTD stepper always rendered.
In EditII, the triangle's QTD drives the shopping list quantity.
`onQuantityChange` updates a local `slQuantity` state:
```typescript
const [slQuantity, setSlQuantity] = useState(shoppingListItem?.quantity ?? 1);
```

Pass to triangle:
```typescript
quantity={slQuantity}
onQuantityChange={setSlQuantity}
```

`handleSave` reads `slQuantity` directly for the SL operations:
```typescript
await addShoppingListItem(inventoryItem.listId, inventoryItem.productName, slQuantity, slPrice);
await updateShoppingListItem(shoppingListItem.id, { quantity: slQuantity, price: slPrice });
```
## 10. Shopping list row

Placed below the price section, above Save button.

```typescript
// State
const [shoppingListQty, setShoppingListQty] = useState(shoppingListItem?.quantity ?? 1);

// When triangle changes, SL qty follows automatically via getValue() at save time
// No need to sync — we read from triangle on save

// Render
{shoppingListItem ? (
  <View style={styles.slRow}>
    <MaterialCommunityIcons name="cart-check" color={theme.colors.primary} size={20} />
    <Text style={{ color: theme.colors.primary, flex: 1 }}>
      Na lista · {shoppingListItem.quantity} emb.
    </Text>
    <Pressable onPress={() => { setShoppingListItem(null); isDirtyRef.current = true; }}>
      <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  </View>
) : (
  <Button
    mode="outlined"
    icon="cart-plus"
    onPress={() => {
      setShoppingListItem({ id: -1, quantity: 1 });
      isDirtyRef.current = true;
    }}
  >
    Adicionar à lista de compras
  </Button>
)}
```

---

## 11. Implementation order

1. `getProductConsumptionStats` — add `avgPricePerUnit90d` and `lowestPricePerUnit90d`
2. `useRetroPrompt` hook — extract from `EditShoppingItemModal`
3. Update `EditShoppingItemModal` to use the hook
4. Add `showQuantity` prop to `PriceTriangle`
5. `EditInventoryItem` — breaking fixes (RefPrice, packageSize params)
6. `EditInventoryItem` — new state (currentRefPrice, lowestRefPricePerUnit, localUnit, unitExpanded, triangleRef)
7. `EditInventoryItem` — `loadAll` updates
8. `EditInventoryItem` — `handleSave` rewrite with batched unit + retro flow
9. `EditInventoryItem` — layout redesign
10. `EditInventoryItem` — PriceTriangle + SL row integration
11. `EditInventoryItem` — stats section with unit-aware display
12. Smoke tests

---

## 12. Not changing

- `useInventoryItem` hook and its API
- Name editing pattern (inline pressable)
- `QuantityHistorySection` / `PriceHistorySection` components
- Dirty tracking (`isDirtyRef`, `mountedRef`, `loadingRef`, `savedRef`)
- `beforeRemove` guard
- Delete flow (`handleDelete`)
- `handleSaveAndGoBack`
- `handleChangeList`, `handleCategorySelect`, `handleCategoryCreate`
- `chartData` computation
- Navigation params