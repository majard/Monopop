import * as SQLite from 'expo-sqlite';

export async function migrateToV9(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS product_store_prices (
      productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      storeId   INTEGER NOT NULL REFERENCES stores(id)   ON DELETE CASCADE,
      price     REAL    NOT NULL,
      updatedAt TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      PRIMARY KEY (productId, storeId)
    );

    CREATE TABLE IF NOT EXISTS product_base_prices (
      productId INTEGER NOT NULL PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      price     REAL    NOT NULL,
      updatedAt TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_product_store_prices_product
      ON product_store_prices(productId);
  `);
}
