import * as SQLite from 'expo-sqlite';

export async function migrateToV10(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('Migrating to V10: Add units support (unit, standard_package_size, package_size, price_per_unit).');

  await db.execAsync(`
    -- Unit of measure for this product (e.g. 'g', 'ml', 'un', 'kg', 'L').
    -- NULL = unit not configured yet; existing price behaviour is unchanged.
    ALTER TABLE products ADD COLUMN unit TEXT;

    -- The quantity of \`unit\` that defines this product's reference price anchor.
    -- e.g. 400 for powder milk (400g), 12 for eggs (1 dozen), 1000 for meat (1kg).
    -- NULL = unit not configured yet (same condition as unit above).
    -- When both unit and standard_package_size are NULL, all price logic falls back
    -- to legacy behaviour (price = price per package, no normalisation).
    ALTER TABLE products ADD COLUMN standard_package_size REAL;

    -- Actual size of the package bought this time, in the product's unit.
    -- NULL = user did not override; assume standard_package_size at read time.
    -- Stored for shrinkflation detection: query alongside price_per_unit over time.
    ALTER TABLE shopping_list_items ADD COLUMN package_size REAL;

    -- price_per_unit = price / package_size (or price_per_package / standard_package_size).
    -- Stored on save so the SLI carries a self-contained record without re-deriving.
    -- NULL for items created before V10 or for products without unit configured.
    ALTER TABLE shopping_list_items ADD COLUMN price_per_unit REAL;

    -- Same two columns on invoice_items for the immutable historical record.
    -- price_per_unit here is the price-per-unit at the moment of purchase —
    -- must not be recalculated after the fact.
    ALTER TABLE invoice_items ADD COLUMN package_size REAL;
    ALTER TABLE invoice_items ADD COLUMN price_per_unit REAL;

    -- package_size on reference price tables: the size of the package that was
    -- available at this store when the reference price was last set.
    -- Needed to reconstruct the shelf situation ("360g packs @ R$13.33/400g equiv")
    -- and for future observed shelf price tracking.
    -- NULL for prices set before V10.
    ALTER TABLE product_store_prices ADD COLUMN package_size REAL;
    ALTER TABLE product_base_prices  ADD COLUMN package_size REAL;
  `);
}
