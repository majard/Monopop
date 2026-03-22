import * as SQLite from 'expo-sqlite';

async function columnExists(db: SQLite.SQLiteDatabase, tableName: string, columnName: string): Promise<boolean> {
  const result = await db.getFirstAsync<{ name: string }>(
    `PRAGMA table_info('${tableName}')`
  );
  // PRAGMA table_info returns multiple rows, need to check all for the column name
  const tableInfo = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info('${tableName}')`
  );
  return tableInfo.some(column => column.name === columnName);
}

export async function migrateToV10(db: SQLite.SQLiteDatabase): Promise<void> {
  console.log('Migrating to V10: Add units support (unit, standardPackageSize, packageSize).');

  // Check and add products.unit
  if (!(await columnExists(db, 'products', 'unit'))) {
    await db.execAsync(`
      -- Unit of measure for this product (e.g. 'g', 'ml', 'un').
      -- NULL = unit not configured yet; existing price behaviour is unchanged.
      ALTER TABLE products ADD COLUMN unit TEXT;
    `);
  }

  // Check and add products.standardPackageSize
  if (!(await columnExists(db, 'products', 'standardPackageSize'))) {
    await db.execAsync(`
      -- The quantity of \`unit\` that defines this product's reference price anchor.
      -- e.g. 400 for powder milk (400g), 12 for eggs (1 dozen), 1000 for meat (1kg).
      -- NULL = unit not configured yet (same condition as unit above).
      -- When both unit and standardPackageSize are NULL, all price logic falls back
      -- to legacy behaviour (price = price per package, no normalisation).
      ALTER TABLE products ADD COLUMN standardPackageSize REAL;
    `);
  }

  // Check and add shopping_list_items.packageSize
  if (!(await columnExists(db, 'shopping_list_items', 'packageSize'))) {
    await db.execAsync(`
      -- Actual size of the package bought this time, in the product's unit.
      -- NULL = user did not override; assume standardPackageSize at read time.
      -- Stored for shrinkflation detection: query alongside paid price over time.
      ALTER TABLE shopping_list_items ADD COLUMN packageSize REAL;
    `);
  }

  // Check and add invoice_items.packageSize
  if (!(await columnExists(db, 'invoice_items', 'packageSize'))) {
    await db.execAsync(`
      -- Same two columns on invoice_items for the immutable historical record.
      -- Paid price stays in unitPrice (REAL with 2 decimal display).
      ALTER TABLE invoice_items ADD COLUMN packageSize REAL;
    `);
  }

  // Check and add product_store_prices.packageSize
  if (!(await columnExists(db, 'product_store_prices', 'packageSize'))) {
    await db.execAsync(`
      -- packageSize on reference price tables: the size of the package that was
      -- available at this store when the reference price was last set.
      -- Needed to reconstruct the shelf situation ("360g packs @ R$13.33/400g equiv")
      -- and for future observed shelf price tracking.
      -- NULL for prices set before V10.
      ALTER TABLE product_store_prices ADD COLUMN packageSize REAL;
    `);
  }

  // Check and add product_base_prices.packageSize
  if (!(await columnExists(db, 'product_base_prices', 'packageSize'))) {
    await db.execAsync(`
      ALTER TABLE product_base_prices ADD COLUMN packageSize REAL;
    `);
  }
}
