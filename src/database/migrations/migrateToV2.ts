import * as SQLite from "expo-sqlite";

export async function migrateToV2(db: SQLite.SQLiteDatabase) {
  console.log("Migrating to V2: Refactor products, add categories, new inventory/shopping tables.");

  // --- Helper to get or create a default list for migration ---
  async function getDefaultListId(): Promise<number> {
    let defaultList = await db.getFirstAsync<{ id: number }>('SELECT id FROM lists ORDER BY `order` ASC LIMIT 1;');
    if (defaultList) {
      return defaultList.id;
    } else {
      console.log("No existing lists found, creating a default 'Main Inventory' list.");
      // Ensure 'lists' table exists before inserting into it (from V1)
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          'order' INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
      `);
      const result = await db.runAsync("INSERT INTO lists (name, `order`) VALUES (?, ?);", ["Main Inventory", 0]);
      if (result.lastInsertRowId) {
        return result.lastInsertRowId;
      } else {
        throw new Error("Failed to create default list during migration.");
      }
    }
  }

  // Get or create default list ID early, this requires 'lists' table to exist (which it does from V1)
  const defaultListId = await getDefaultListId();


  // --- 1. Create ALL new tables with IF NOT EXISTS first ---
  // This ensures all tables for V2 schema are present before any data operations.

  // Categories table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // New products table (target schema for V2)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      categoryId INTEGER,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY(categoryId) REFERENCES categories(id) ON DELETE SET NULL
    );
  `);
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);`);
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_products_categoryid ON products (categoryId);`);


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
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE,
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(listId, productId)
    );
  `);
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_items_listid_productid ON inventory_items (listId, productId);`);


  // inventory_history table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS inventory_history (
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
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_inventory_history_itemid ON inventory_history (inventoryItemId);`);


  // shopping_list_items table
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS shopping_list_items (
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
  await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_shopping_list_items_itemid ON shopping_list_items (inventoryItemId);`);


  // --- 2. Data Migration & Table Renames/Transforms ---

  // Flags for product migration state
  let currentProductsTableExists = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='products';`)) !== undefined;
  let oldProductsTableExistsAsRenamed = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='products_old_v1';`)) !== undefined;
  let newProductsTableIsPopulated = (await db.getFirstAsync(`SELECT COUNT(*) FROM products;`))?.['COUNT(*)'] > 0;

  // Handle renaming of original 'products' table to 'products_old_v1'
  // This means if 'products' still exists in its V1 form and hasn't been renamed before, do it.
  // And the new 'products' table shouldn't be populated yet (otherwise migration already completed).
  if (currentProductsTableExists && !oldProductsTableExistsAsRenamed && !newProductsTableIsPopulated) {
      console.log("Renaming old 'products' table to 'products_old_v1' for migration.");
      await db.runAsync(`ALTER TABLE products RENAME TO products_old_v1;`);
      oldProductsTableExistsAsRenamed = true; // Update flag
      currentProductsTableExists = false; // Original 'products' no longer exists by this name
  } else if (!currentProductsTableExists && oldProductsTableExistsAsRenamed && !newProductsTableIsPopulated) {
      // This is a scenario where the rename happened, but the app crashed before data migration.
      // The old products table is already renamed, but the new one isn't populated.
      console.log("'products' table already renamed to 'products_old_v1', proceeding with data migration.");
  }


  // Migrate data from 'products_old_v1' to new 'products'
  // Only insert if products_old_v1 exists AND the new products table is NOT populated.
  // We re-check population here as other logic might have run.
  newProductsTableIsPopulated = (await db.getFirstAsync(`SELECT COUNT(*) FROM products;`))?.['COUNT(*)'] > 0;

  if (oldProductsTableExistsAsRenamed && !newProductsTableIsPopulated) {
      console.log("Migrating data from 'products_old_v1' to new 'products'.");
      await db.runAsync(`
          INSERT OR IGNORE INTO products (name, createdAt, updatedAt)
          SELECT name, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM products_old_v1;
      `);
      newProductsTableIsPopulated = true; // Mark as populated after attempt
  }

  // Migrate data from 'products_old_v1' to 'inventory_items'
  // Use the defaultListId
  const inventoryItemsCount = (await db.getFirstAsync(`SELECT COUNT(*) FROM inventory_items;`))?.['COUNT(*)'] || 0;
  // Make sure to query products_old_v1 *only if it exists*.
  const oldProductsCount = oldProductsTableExistsAsRenamed ? (await db.getFirstAsync(`SELECT COUNT(*) FROM products_old_v1;`))?.['COUNT(*)'] || 0 : 0;

  if (oldProductsTableExistsAsRenamed && inventoryItemsCount < oldProductsCount) {
      console.log("Migrating data from 'products_old_v1' to 'inventory_items'.");
      await db.runAsync(`
          INSERT OR IGNORE INTO inventory_items (listId, productId, quantity, sortOrder, createdAt, updatedAt)
          SELECT
              ?,             -- Use the defaultListId
              np.id,         -- New product ID
              pov.quantity,
              pov.\`order\`, -- Old 'order' column from products_old_v1
              strftime('%Y-%m-%dT%H:%M:%fZ','now'),
              strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM products_old_v1 pov
          JOIN products np ON pov.name = np.name;
      `, [defaultListId]);
  }


  // --- IDEMPOTENT QUANTITY HISTORY MIGRATION ---

  // Flags for quantity history migration state
  let currentQuantityHistoryTableExists = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history';`)) !== undefined;
  let oldQuantityHistoryTableExistsAsRenamed = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history_old_v1';`)) !== undefined;
  let newInventoryHistoryIsPopulated = (await db.getFirstAsync(`SELECT COUNT(*) FROM inventory_history;`))?.['COUNT(*)'] > 0;


  // Handle renaming of original 'quantity_history' table to 'quantity_history_old_v1'
  if (currentQuantityHistoryTableExists && !oldQuantityHistoryTableExistsAsRenamed && !newInventoryHistoryIsPopulated) {
      console.log("Renaming old 'quantity_history' table to 'quantity_history_old_v1' for migration.");
      await db.runAsync(`ALTER TABLE quantity_history RENAME TO quantity_history_old_v1;`);
      oldQuantityHistoryTableExistsAsRenamed = true;
      currentQuantityHistoryTableExists = false;
  } else if (!currentQuantityHistoryTableExists && oldQuantityHistoryTableExistsAsRenamed && !newInventoryHistoryIsPopulated) {
      // Already renamed, but new table not populated
      console.log("'quantity_history' table already renamed to 'quantity_history_old_v1', proceeding with data migration.");
  }


  // Migrate data from 'quantity_history_old_v1' to new 'inventory_history'
  // Only insert if products_old_v1 exists AND the new products table is NOT populated.
  newInventoryHistoryIsPopulated = (await db.getFirstAsync(`SELECT COUNT(*) FROM inventory_history;`))?.['COUNT(*)'] > 0;
  console.log("newInventoryHistoryIsPopulated:", newInventoryHistoryIsPopulated);
  console.log("oldQuantityHistoryTableExistsAsRenamed:", oldQuantityHistoryTableExistsAsRenamed);
  console.log("currentQuantityHistoryTableExists:", currentQuantityHistoryTableExists);

  if (oldQuantityHistoryTableExistsAsRenamed && !newInventoryHistoryIsPopulated) {
      console.log("Migrating data from 'quantity_history_old_v1' to new 'inventory_history'.");
      await db.runAsync(`
          INSERT OR IGNORE INTO inventory_history (inventoryItemId, date, quantity, createdAt)
          SELECT
              ii.id, -- Get the new inventoryItemId
              qhov.date,
              qhov.quantity,
              strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM quantity_history_old_v1 qhov
          JOIN products_old_v1 pov ON qhov.productId = pov.id
          JOIN products np ON pov.name = np.name
          JOIN inventory_items ii ON ii.productId = np.id AND ii.listId = ?;
      `, [defaultListId]); // Pass defaultListId as a parameter
  }


  // --- 3. Clean up old tables ---
  // These drops should now be safe because the data migration is idempotent and complete
  if (oldProductsTableExistsAsRenamed) {
      console.log("Dropping old 'products_old_v1' table.");
      await db.runAsync(`DROP TABLE IF EXISTS products_old_v1;`);
  }
  if (oldQuantityHistoryTableExistsAsRenamed) {
      console.log("Dropping old 'quantity_history_old_v1' table.");
      await db.runAsync(`DROP TABLE IF EXISTS quantity_history_old_v1;`);
  }
}