import * as SQLite from "expo-sqlite";

export async function migrateToV4(db: SQLite.SQLiteDatabase) {
  console.log("Migrating to V4: Add settings table.");

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // Insert default settings
  await db.runAsync(`
    INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('lastOpenedListId', NULL),
    ('defaultStoreId', NULL);
  `);
}
