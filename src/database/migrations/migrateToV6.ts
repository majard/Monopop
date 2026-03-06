import * as SQLite from "expo-sqlite";

export async function migrateToV6(db: SQLite.SQLiteDatabase) {
  console.log("Migrating to V6: Fix inventory_history and shopping_list_items FK references.");
  await db.runAsync('PRAGMA foreign_keys = OFF;');

  // Fix inventory_history
  await db.runAsync(`ALTER TABLE inventory_history RENAME TO inventory_history_old;`);
  await db.runAsync(`
    CREATE TABLE inventory_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventoryItemId INTEGER NOT NULL,
      date TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(inventoryItemId, date),
      FOREIGN KEY(inventoryItemId) REFERENCES inventory_items(id) ON DELETE CASCADE
    );
  `);
  await db.runAsync(`INSERT INTO inventory_history SELECT * FROM inventory_history_old;`);
  await db.runAsync(`DROP TABLE inventory_history_old;`);
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_history_itemid ON inventory_history (inventoryItemId);`);

  // Fix shopping_list_items
  await db.runAsync(`ALTER TABLE shopping_list_items RENAME TO shopping_list_items_old;`);
  await db.runAsync(`
    CREATE TABLE shopping_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventoryItemId INTEGER NOT NULL UNIQUE,
      quantity INTEGER NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      price REAL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY(inventoryItemId) REFERENCES inventory_items(id) ON DELETE CASCADE
    );
  `);
  await db.runAsync(`INSERT INTO shopping_list_items SELECT * FROM shopping_list_items_old;`);
  await db.runAsync(`DROP TABLE shopping_list_items_old;`);
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_shopping_list_items_itemid ON shopping_list_items (inventoryItemId);`);

  await db.runAsync('PRAGMA foreign_keys = ON;');
}
