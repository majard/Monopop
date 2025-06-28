import * as SQLite from "expo-sqlite";

export async function migrateToV1(db: SQLite.SQLiteDatabase) {
    console.log("Migrating to V1: Initial table creation (basic structure)");
    // This would contain your very first CREATE TABLE statements
    // (e.g., the original 'products' with quantity and listId, 'quantity_history', 'lists')
    await Promise.all([
      db.runAsync(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          quantity INTEGER NOT NULL,
          \`order\` INTEGER NOT NULL DEFAULT 0,
          listId INTEGER NOT NULL DEFAULT 1
        );
      `),
      db.runAsync(`
        CREATE TABLE IF NOT EXISTS quantity_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          date TEXT NOT NULL,
          UNIQUE(productId, date),
          FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
        );
      `),
      db.runAsync(`
        CREATE TABLE IF NOT EXISTS lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          \`order\` INTEGER NOT NULL DEFAULT 0
        );
      `),
    ]);
}
  