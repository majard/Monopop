import * as SQLite from "expo-sqlite";

export async function migrateToV3(db: SQLite.SQLiteDatabase) {
  console.log("Migrating to V3: Add stores + invoices + invoice_items.");

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      storeId INTEGER NOT NULL,
      listId INTEGER NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY(storeId) REFERENCES stores(id) ON DELETE RESTRICT,
      FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE
    );
  `);

  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_invoices_storeId_createdAt ON invoices (storeId, createdAt);`);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unitPrice REAL,
      lineTotal REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY(invoiceId) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_invoice_items_productId ON invoice_items (productId);`);
}
