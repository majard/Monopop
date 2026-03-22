# Monopop v1.7.0 — Units Feature Specification
> Master plan. Reference this document throughout implementation. Update as decisions change.
>
> Last updated: session 3 (atomic units, label fix, legacy invoice handling, retroactive “Não” safety)

---

## Current state of the app

Monopop is an offline-first Android inventory and shopping list manager (React Native, Expo SDK 54 bare workflow, expo-sqlite V8 with WAL mode). Currently at v1.6.0.

Two core flows:

**Shopping lists:** user adds products → goes to supermarket → checks off items → records prices → concludes invoice. On conclude, reference prices are optionally updated per store.

**Inventory:** products have a `quantity` (integer, package count). Incremented on invoice conclude.

**Reference prices (v1.6.0):** two tables — `product_store_prices` and `product_base_prices`. Lookup chain: store ref → base ref → last invoice@store → last invoice any store. Currently the stored value (`price`) means "price paid per package" with no unit normalization.

---

## The problem we're solving

Today Monopop records prices per package with no awareness of package size or unit. Price comparison is meaningless across different package sizes:

- R$14.00 for 400g powder milk vs R$12.00 for 360g — which is cheaper?
- R$8.00 for 12 eggs vs R$18.00 for 30 eggs — better deal?
- R$35.90/kg meat, bought 670g — what did it actually cost?

The user cannot answer these questions without mental arithmetic. Monopop v1.7.0 does it for them, in real time.

---

## Core architectural decision

**Store paid price per package + `packageSize`. Derive per-unit values.**

```
price_per_unit = price_per_package / package_size

display per standard package = price_per_unit × standardPackageSize     → R$13.33/400g
display per unit             = price_per_unit                           → R$0.0333/g
```

The stored invariants are the purchase facts: `price` (paid per package) and `packageSize`. Per-unit is derived on the fly. This keeps paid prices exact (cents) while still supporting cross-size comparison.

Consequence: `product_store_prices.price` and `product_base_prices.price` now semantically mean paid price per package, with `packageSize` providing the context required to derive per-unit values.

---

## Naming — English and Portuguese

Load-bearing. Every name must communicate exactly one thing.

Note: DB column names use camelCase in SQLite for this project (`standardPackageSize`, `packageSize`).

| Concept | Field name | PT UI label | Notes |
|---|---|---|---|
| Unit of measure | `unit` | "Unidade" | Atomic base: `g`, `ml`, `un`. Nullable — if null, price is treated as legacy price-per-package |
| Reference package size | `standardPackageSize` | "Embalagem padrão" | What the product is understood in. 400g for powder milk, 12 for eggs, 1000g for meat. Nullable — if null, treat price as legacy price-per-package |
| This purchase's package size | `packageSize` | "Quantidade adquirida" | Actual size of the package bought this time, in the product's `unit`. Nullable — if null, assume the store's ref `packageSize`, else `standardPackageSize` |
| How many packages bought | `package_quantity` | "Quantidade" | Integer always. This is how many packages the user is buying, not the quantity inside each package |
| Shelf label price | `price_per_package` | "Preço por [emb. padrão]" | What the shelf implies for the standard package. Derived, never stored. Label uses `standardPackageSize` + `unit` display formatting |
| Actual price paid | `price` | "Preço pago" | Paid price for one package of size `packageSize`. One of the three editable triangle fields |
| Price per unit of measure | *(derived, not stored)* | "Preço por unidade" | `price / packageSize` (e.g. R$/g, R$/ml, R$/un). Derived on the fly |
| Total paid | *(derived)* | "Total" | `price × package_quantity`. Computed live, never stored |

**Note on `product_store_prices.price` and `product_base_prices.price`:** column name stays `price` for minimal disruption.

- `price` means paid price per package (both legacy and unit-configured products)
- For unit-configured products, `packageSize` is required to derive per-unit values

This requires that any reference-price read joins `products` and branches on `products.unit`.

---

## Units — scope and display conventions

### Stored unit values (atomic)

Units are stored as atomic bases only:

- Mass: `g`
- Volume: `ml`
- Count: `un`

No “dozen” or similar composite units are stored as `unit`. Composite concepts are represented via `standard_package_size` (e.g., eggs: `unit=un`, `standard_package_size=12`).

### Display formatting for standard package

UI formats the standard package size as:

- For `unit=g` and `standard_package_size=1000`: display `1kg`
- For `unit=ml` and `standard_package_size=1000`: display `1L`
- Otherwise: display `{standard_package_size}{unit}` (e.g., `400g`, `12un`)

**UI label for `price_per_package`:** "Preço por {formatted_standard_package}" (e.g., "Preço por 400g", "Preço por 1kg", "Preço por 12un").

---

## Database schema — new fields

### `products` table

```sql
ALTER TABLE products ADD COLUMN unit TEXT;
-- unit of measure: 'g', 'ml', 'un'
-- NULL = unit not configured yet, treat price as legacy price-per-package

ALTER TABLE products ADD COLUMN standardPackageSize REAL;
-- quantity of `unit` that defines this product's reference price
-- e.g. 400 (400g powder milk), 12 (eggs), 1000 (1kg meat)
-- NULL = unit not configured yet (same condition as unit above)
```

Both nullable. NULL means the product predates units or the user hasn’t set them yet. When both are null, existing price behaviour is unchanged.

### `shopping_list_items` table

```sql
ALTER TABLE shopping_list_items ADD COLUMN packageSize REAL;
-- actual size of the package bought this time, in the product's unit
-- NULL = assume store/base ref packageSize; if missing, fall back to standardPackageSize

-- existing `quantity` column: represents package_quantity (how many packages bought)
```

### `invoice_items` table

```sql
ALTER TABLE invoice_items ADD COLUMN packageSize REAL;
-- actual size bought, stored for shrinkflation analysis later

-- existing `quantity` column: same package_quantity note as shopping_list_items
```

### Fields never stored (always derived)

```
price_per_unit    = price / packageSize
price_per_package = price_per_unit × standardPackageSize
total_price       = price × package_quantity
```

---

## Migration strategy (V10)

```sql
ALTER TABLE products ADD COLUMN unit TEXT;
ALTER TABLE products ADD COLUMN standardPackageSize REAL;

ALTER TABLE shopping_list_items ADD COLUMN packageSize REAL;

ALTER TABLE invoice_items ADD COLUMN packageSize REAL;

ALTER TABLE product_store_prices ADD COLUMN packageSize REAL;
ALTER TABLE product_base_prices  ADD COLUMN packageSize REAL;

-- product_store_prices and product_base_prices: no schema change besides packageSize.
-- Column semantics updated via comment/notes only.
```

Backward compatibility:

- Existing products without `unit`/`standard_package_size` keep legacy behaviour.
- Unit-aware suggestions/comparisons must not reinterpret legacy reference prices or legacy invoice rows as per-unit.

---

## Retroactive reference calculation (first-time unit setup)

When the user sets `unit` and `standard_package_size` on a product for the first time, show an alert:

> **"Calcular preço por unidade histórico?"**
>
> Encontramos sua última compra deste produto. Você pode usar o tamanho da embalagem que comprou para calcular o preço por unidade automaticamente. Se ainda lembrar ou tiver a nota, insira o tamanho da embalagem (ex: 400g).
>
> **[Cancelar]** — does nothing, unit/standard not saved
> **[Não]** — saves unit + standard; clears existing reference prices for this product to avoid ambiguity
> **[Sim]** — opens package size input, pre-filled with standard_package_size

**"Sim" flow:**

1. Fetch last invoice item for this product
2. Show input: "Qual era o tamanho da embalagem?" pre-filled with `standard_package_size`
3. Upsert `product_store_prices` (for that invoice’s store) and `product_base_prices` with `last_invoice_price` and the entered package size

Runs once per product. May drift if the user doesn’t remember the exact package size — acceptable.

**Why “Não” clears reference prices:**

Reference-price rows created before units exist are semantically “price per package”. After setting `unit`, that same stored number becomes ambiguous and can be misread as “price per unit”. Clearing avoids silent wrong suggestions.

---

## Legacy invoice handling (unit-configured products)

Old invoice rows (pre-v1.7) will not have `invoice_items.packageSize`.

For products with `products.unit IS NOT NULL`:

- Any feature that requires unit-aware comparisons or price suggestion fallbacks must ignore invoice rows without `packageSize` (treat as unknown), rather than guessing.
- Legacy invoice rows remain visible as historical purchases; they just don’t participate in per-unit logic.

For reference price rows on unit-configured products:

- `product_store_prices.price` and `product_base_prices.price` are interpreted as paid price per package
- `product_store_prices.packageSize` / `product_base_prices.packageSize` represent the package size that price was observed/set for at that store/base
- If `products.unit IS NOT NULL` and a ref row has `packageSize IS NULL`, treat it as legacy/ambiguous and ignore it

---

## The purchase triangle

**Price per unit is not directly editable.** It is always derived and displayed only.

Three editable fields. Any two determine the third, given `standard_package_size` is known from the product:

```
pricePerUnit = price / packageSize
price_per_package = pricePerUnit × standardPackageSize
```

Derivations:

```
given price_per_package + packageSize:
  price = (price_per_package / standardPackageSize) × packageSize

given price_per_package + price:
  packageSize = (price / price_per_package) × standardPackageSize

given price + packageSize:
  price_per_package = (price / packageSize) × standardPackageSize
```

| Editable field | What it represents | Example (meat@1kg std) |
|---|---|---|
| `price_per_package` | Shelf label price per standard package | R$35.90/1kg |
| `package_size` | Actual size of what you're buying | 670g |
| `price` | Actual amount you'll pay at checkout | R$24.05 |

The UI tracks which fields have been touched and auto-fills the untouched one live. Implementation detail: `lastTouchedFields` tracks the last two edited fields — those two are inputs, the third is derived.

---

## Reference price update flow

### Store pre-selected

- `price_per_package`, `package_size`, `price` editable in EditSLI modal
- `price_per_unit` derived and displayed live — not stored
- Saved on "Salvar" / back navigation (current behaviour)
- Cancelled on "Cancelar" (current behaviour)
- ☑ "Atualizar preço de referência?" — defaults ON → upserts `product_store_prices.price` with the paid price per package
- ☐ "Atualizar embalagem padrão para X?" — defaults OFF → if checked, updates `products.standard_package_size`
- Toggle OFF on ref price: still saves SLI and invoice, only skips the `product_store_prices` upsert

### No store pre-selected

- Same flow but upserts `product_base_prices.price` with the paid price per package
- On checkout (ConfirmInvoiceModal): existing checkbox opts-in to update per-store prices
- Current behaviour maintained

### Changing standard_package_size

Because reference prices are stored as paid price per package, changing `standard_package_size` only affects how the price is displayed. No cascade migration needed.

---

## Inventory transform

When `package_size ≠ standard_package_size`, inventory increment is:

```
inventory_increment = max(1, round((package_size × package_quantity) / standard_package_size))
```

Rules:

- Apply `round` to the total quantity (not per-package) to minimise drift over time
- Enforce minimum 1 — the user bought something, inventory must reflect that
- Result is always a positive integer

Known limitation (by design): inventory is an approximation. Precision lives at purchase time for price computation. Inventory tracks approximate package counts.

---

## EditSLI modal — UX direction

Decision: explicit expand button (“Mostrar mais”).

Collapsed (no unit set, or simple product):

```
[Product name]
Qtd: [1]   Preço: [R$14.00]
                        [↓ Mostrar mais]
```

Expanded (unit set):

```
[Product name]

Preço por 1kg:      [R$35.90]     ← editable (label adapts to standard display)
Quantidade (g):     [670]         ← editable (package_size)
Preço pago:         [R$24.05]     ← editable

──────────────────────────────────
Preço por unidade:  R$0.0359/g    ← derived, display only
Por emb. padrão:    R$35.90/1kg   ← derived, display only
Total:              R$24.05       ← derived (× package_quantity)
──────────────────────────────────
Qtd de embalagens:  [1]           ← package_quantity, integer

☑ Atualizar preço de referência
☐ Atualizar embalagem padrão para 670g

[Cancelar]                  [Salvar]
```

---

## Full examples

### Powder milk — `standard_package_size=400, unit=g`

Usual pack:

- Input: `price_per_package=14.00, package_size=400, package_quantity=1`
- `price_per_unit = 14.00/400 = 0.035/g`, `price = R$14.00`
- Display: R$0.035/g · R$14.00/400g · Total R$14.00
- Inventory += 1

Different size (360g):

- Input: `price_per_package=12.00, package_size=360`
- `price = (12.00/400) × 360 = R$10.80` ← auto-filled
- `price_per_unit = 0.0333/g`
- Display: R$0.0333/g · R$13.33/400g — cheaper than reference
- Inventory += max(1, round(360/400)) = 1

Two 360g packs:

- `package_quantity=2`, `price_per_unit` unchanged
- Total: R$10.80 × 2 = R$21.60
- Inventory += max(1, round(720/400)) = 2

---

### Eggs — `standard_package_size=12, unit=un`

Standard dozen-equivalent (stored as `12un`):

- Input: `price_per_package=8.00, package_size=12`
- `price_per_unit = 8/12 = R$0.667/un`, `price = R$8.00`
- Display: R$0.667/un · R$8.00/12un

30-pack:

- Input: `price_per_package=18.00, package_size=30`
- `price_per_unit = 18/30 = R$0.60/un`
- Display: R$0.60/un · R$7.20/12un — cheaper
- Inventory += max(1, round(30/12)) = 3

---

### Meat — `standard_package_size=1000, unit=g`

Supermarket label shows three things: price/kg, weight, total. Triangle accepts any two.

Input shelf price/kg + weight (most natural):

- `price_per_package=35.90, package_size=670`
- `price = (35.90/1000) × 670 = R$24.05` ← auto-filled
- Display: R$0.0359/g · R$35.90/1kg · Total R$24.05
- Inventory += max(1, round(670/1000)) = 1

Input price paid + weight:

- `price=24.05, package_size=670`
- `price_per_package = (24.05/670) × 1000 = R$35.90` ← auto-filled

Input shelf price + price paid (didn't look at weight label):

- `price_per_package=35.90, price=24.05`
- `package_size = (24.05/35.90) × 1000 = 670g` ← auto-filled

---

## What persists vs what's derived

| Field | Stored where | Persists? |
|---|---|---|
| `unit` | products | yes, nullable |
| `standard_package_size` | products | yes, nullable |
| `price` (= price paid) | product_store_prices / product_base_prices | yes, opt-in, semantics depend on `products.unit` |
| `package_size` | shopping_list_items + invoice_items | yes |
| `package_quantity` | shopping_list_items + invoice_items | yes |
| `price_per_unit` | shopping_list_items + invoice_items | yes |
| `price_per_package` | nowhere | derived live |
| `total_price` | nowhere | derived live |

---

## Open implementation questions

1. Triangle state machine: `lastTouchedFields` ref tracks last two edited fields; third is auto-filled. Edge case: all three edited sequentially — last two win.

2. Display precision: how many decimal places for `price_per_unit`? Likely significant figures depending on magnitude (R$0.0333/g vs R$1.20/un).

3. Storage rounding: how many decimals to persist for `price_per_unit` to avoid churn across saves?

---

## Explicitly out of scope for v1.7.0

- Product variants / multiple package sizes per product (natural trigger: barcode scanning)
- Brand / alias system (same roadmap milestone — all tie back to one canonical product)
- Cross-product comparison ("which brand is cheapest per g?")
- Nested units (toilet paper: rolls × meters)
- Unit category enforcement (mass vs volume vs count)
- Integer micro-currency storage (REAL is sufficient at this scale)
- Shrinkflation detection UI (data captured, feature deferred)
- Observed shelf price persistence per store/product (candidate for v1.8.0)
