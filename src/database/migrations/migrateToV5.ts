import * as SQLite from "expo-sqlite";

export async function migrateToV5(db: SQLite.SQLiteDatabase) {
  console.log("Migrating to V5: Fix inventory_items FK reference to products.");
  await db.runAsync('PRAGMA foreign_keys = OFF;');

  await db.runAsync(`ALTER TABLE inventory_items RENAME TO inventory_items_old;`);

  await db.runAsync(`
    CREATE TABLE inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE,
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(listId, productId)
    );
  `);

  await db.runAsync(`INSERT INTO inventory_items SELECT * FROM inventory_items_old;`);
  await db.runAsync(`DROP TABLE inventory_items_old;`);
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_items_listid_productid ON inventory_items (listId, productId);`);

  await db.runAsync('PRAGMA foreign_keys = ON;');
}
