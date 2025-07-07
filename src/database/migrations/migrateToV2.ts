import * as SQLite from "expo-sqlite";

export async function migrateToV2(db: SQLite.SQLiteDatabase) {
  console.log("Migrating to V2: Refactor products, add categories, new inventory/shopping tables.");

  // Note: db.withExclusiveTransactionAsync is handled in runMigrations,
  // so no need for an internal transaction here.

  // 1. Create the new tables with their final desired schema

  // Categories table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // inventory_items table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      A
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE,
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(listId, productId) -- Ensure only one entry per product per list
    );
  `);
  // Add index for faster lookups by listId and productId
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_items_listid_productid ON inventory_items (listId, productId);`);


  // inventory_history table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS inventory_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventoryItemId INTEGER NOT NULL, -- Direct link to inventory_items
      date TEXT NOT NULL, -- YYYY-MM-DD
      quantity INTEGER NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(inventoryItemId, date), -- Unique per inventory item per day
      FOREIGN KEY(inventoryItemId) REFERENCES inventory_items(id) ON DELETE CASCADE
    );
  `);
  // Add index for faster lookups by inventoryItemId
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_history_itemid ON inventory_history (inventoryItemId);`);


  // shopping_list_items table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS shopping_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventoryItemId INTEGER NOT NULL UNIQUE, -- Unique: one shopping item per inventory item
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
  // Add index for faster lookups by inventoryItemId
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_shopping_list_items_itemid ON shopping_list_items (inventoryItemId);`);


  // 2. Data Migration & Table Renames/Transforms for 'products' and 'quantity_history'

  const productsTableExists = (await db.getFirstSync(`SELECT name FROM sqlite_master WHERE type='table' AND name='products';`)) !== undefined;

  if (productsTableExists) {
      console.log("Renaming old 'products' table to 'products_old_v1' for migration.");
      await db.runAsync(`ALTER TABLE products RENAME TO products_old_v1;`);
  }

  // Create the new 'products' table with the updated schema
  // (No IF NOT EXISTS here, as it's intended to be created fresh or already handled by rename)
  await db.runAsync(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        categoryId INTEGER,
        createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        FOREIGN KEY(categoryId) REFERENCES categories(id) ON DELETE SET NULL
      );
  `);
  // Add index for faster lookups by name
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);`);
  // Add index for categoryId
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_products_categoryid ON products (categoryId);`);


  // Migrate data from 'products_old_v1' to new 'products'
  if (productsTableExists) {
      console.log("Migrating data from 'products_old_v1' to new 'products'.");
      await db.runAsync(`
          INSERT OR IGNORE INTO products (name, createdAt, updatedAt)
          SELECT name, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM products_old_v1;
      `);
  }

  // Migrate data from 'products_old_v1' to 'inventory_items'
  if (productsTableExists) {
      console.log("Migrating data from 'products_old_v1' to 'inventory_items'.");
      await db.runAsync(`
          INSERT INTO inventory_items (listId, productId, quantity, sortOrder, createdAt, updatedAt)
          SELECT
              pov.listId,
              np.id,       -- New product ID
              pov.quantity,
              pov.\`order\`, -- Old order column
              strftime('%Y-%m-%dT%H:%M:%fZ','now'),
              strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM products_old_v1 pov
          JOIN products np ON pov.name = np.name;
      `);
  }

  const quantityHistoryTableExists = (await db.getFirstSync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history';`)) !== undefined;
  if (quantityHistoryTableExists) {
      console.log("Renaming old 'quantity_history' table to 'quantity_history_old_v1' for migration.");
      await db.runAsync(`ALTER TABLE quantity_history RENAME TO quantity_history_old_v1;`);

      // Migrate data from 'quantity_history_old_v1' to new 'inventory_history'
      console.log("Migrating data from 'quantity_history_old_v1' to new 'inventory_history'.");
      await db.runAsync(`
          INSERT INTO inventory_history (inventoryItemId, date, quantity, createdAt)
          SELECT
              ii.id, -- Get the new inventoryItemId
              qhov.date,
              qhov.quantity,
              strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM quantity_history_old_v1 qhov
          JOIN products_old_v1 pov ON qhov.productId = pov.id -- To get old listId and product name
          JOIN products np ON pov.name = np.name -- To get new productId
          JOIN inventory_items ii ON ii.productId = np.id AND ii.listId = pov.listId; -- To get the new inventoryItemId
      `);
  }

  // 3. Clean up old tables
  if (productsTableExists) {
      console.log("Dropping old 'products_old_v1' table.");
      await db.runAsync(`DROP TABLE IF EXISTS products_old_v1;`);
  }
  if (quantityHistoryTableExists) {
      console.log("Dropping old 'quantity_history_old_v1' table.");
      await db.runAsync(`DROP TABLE IF EXISTS quantity_history_old_v1;`);
  }
}