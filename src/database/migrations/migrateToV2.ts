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

  const defaultListId = await getDefaultListId(); // Get or create default list ID early


  // --- 1. Create ALL new tables with IF NOT EXISTS first ---
  // This ensures all target tables for V2 schema are present before any data operations.

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
  let currentProductsTableExists = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='products';`)) !== null;
  let oldProductsTableExistsAsRenamed = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='products_old_v1';`)) !== null;
  let newProductsTableIsPopulated = (await db.getFirstAsync(`SELECT COUNT(*) FROM products;`))?.['COUNT(*)'] > 0;

  // Handle renaming of original 'products' table to 'products_old_v1'
  if (currentProductsTableExists && !oldProductsTableExistsAsRenamed && !newProductsTableIsPopulated) {
      console.log("Renaming old 'products' table to 'products_old_v1' for migration.");
      await db.runAsync(`ALTER TABLE products RENAME TO products_old_v1;`);
      oldProductsTableExistsAsRenamed = true; // Update flag
      currentProductsTableExists = false; // Original 'products' no longer exists by this name
  } else if (!currentProductsTableExists && oldProductsTableExistsAsRenamed && !newProductsTableIsPopulated) {
      console.log("'products' table already renamed to 'products_old_v1', proceeding with data migration.");
  }


  // Migrate data from 'products_old_v1' to new 'products'
  newProductsTableIsPopulated = (await db.getFirstAsync(`SELECT COUNT(*) FROM products;`))?.['COUNT(*)'] > 0;

  if (oldProductsTableExistsAsRenamed && !newProductsTableIsPopulated) {
      console.log("Migrating data from 'products_old_v1' to new 'products'.");
      await db.runAsync(`
          INSERT OR IGNORE INTO products (name, createdAt, updatedAt)
          SELECT name, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM products_old_v1;
      `);
      newProductsTableIsPopulated = true;
  }

  // Migrate data from 'products_old_v1' to 'inventory_items'
  const inventoryItemsCount = (await db.getFirstAsync(`SELECT COUNT(*) FROM inventory_items;`))?.['COUNT(*)'] || 0;
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

  // Check if original 'quantity_history' table (from V1) exists.
  // This is the absolute prerequisite for any rename or migration from it.
  let originalQuantityHistoryExists = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history';`)) !== null;
  // Check if the old table was already renamed in a previous run.
  let oldQuantityHistoryTableExistsAsRenamed = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history_old_v1';`)) !== null;

  console.log('oldqhov: ', await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history_old_v1';`))
  // Combine these for the overall condition to proceed with QH migration logic
  const shouldAttemptQuantityHistoryMigration = originalQuantityHistoryExists || oldQuantityHistoryTableExistsAsRenamed;

  console.log("--- Quantity History Migration Status ---");
  console.log("  Original 'quantity_history' (V1) exists:", originalQuantityHistoryExists);
  console.log("  'quantity_history_old_v1' exists (renamed):", oldQuantityHistoryTableExistsAsRenamed);
  console.log("  Proceed with QH migration logic:", shouldAttemptQuantityHistoryMigration);


  if (shouldAttemptQuantityHistoryMigration) {
      let newInventoryHistoryIsPopulated = (await db.getFirstAsync(`SELECT COUNT(*) FROM inventory_history;`))?.['COUNT(*)'] > 0;
      console.log("  New 'inventory_history' table is populated:", newInventoryHistoryIsPopulated);

      // Handle renaming of original 'quantity_history' table to 'quantity_history_old_v1'
      // This block only runs if the original V1 table exists and hasn't been renamed yet.
      if (originalQuantityHistoryExists && !oldQuantityHistoryTableExistsAsRenamed && !newInventoryHistoryIsPopulated) {
          console.log("  Renaming old 'quantity_history' table to 'quantity_history_old_v1' for migration.");
          await db.runAsync(`ALTER TABLE quantity_history RENAME TO quantity_history_old_v1;`);
          // Update flags after successful rename
          oldQuantityHistoryTableExistsAsRenamed = true;
          originalQuantityHistoryExists = false;
      } else if (!originalQuantityHistoryExists && oldQuantityHistoryTableExistsAsRenamed && !newInventoryHistoryIsPopulated) {
          // This scenario means it was renamed in a previous attempt, but data migration didn't complete
          console.log("  'quantity_history' table already renamed to 'quantity_history_old_v1', proceeding with data migration.");
      }
      else if (originalQuantityHistoryExists && oldQuantityHistoryTableExistsAsRenamed && newInventoryHistoryIsPopulated) {
          console.log("  'quantity_history' table already renamed to 'quantity_history_old_v1', proceeding with data migration.");
      }

      // Migrate data from 'quantity_history_old_v1' to new 'inventory_history'
      newInventoryHistoryIsPopulated = (await db.getFirstAsync(`SELECT COUNT(*) FROM inventory_history;`))?.['COUNT(*)'] > 0;

      // This is the crucial check: Only attempt the INSERT if the source table exists *and* the target is not populated.
      if (oldQuantityHistoryTableExistsAsRenamed && !newInventoryHistoryIsPopulated) {
          console.log("  Executing data migration from 'quantity_history_old_v1' to new 'inventory_history'.");
          
          console.log(await db.runAsync(`SELECT * FROM quantity_history_old_v1;`));
          
          console.log('quantity_history_old_v1 table is populated');
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
          `, [defaultListId]);
      } else {
          console.log("  Skipping 'quantity_history' data migration. Conditions not met.");
          if (!oldQuantityHistoryTableExistsAsRenamed) {
              console.log("    Reason: 'quantity_history_old_v1' does not exist or was not renamed correctly.");
          }
          if (newInventoryHistoryIsPopulated) {
              console.log("    Reason: 'inventory_history' is already populated.");
          }
      }
  } else {
      console.log("Skipping entire 'quantity_history' migration block because no original 'quantity_history' or renamed 'quantity_history_old_v1' table was found.");
      // If for some reason quantity_history_old_v1 was left behind without original_qh_exists, clean it up.
      if (oldQuantityHistoryTableExistsAsRenamed) {
          console.log("  Cleaning up remnant 'quantity_history_old_v1' table from a prior partial failure.");
          await db.runAsync(`DROP TABLE IF EXISTS quantity_history_old_v1;`);
      }
  }

  // --- 3. Clean up old tables ---
  // Ensure these flags are up-to-date or re-queried if needed.
  // In this structure, they should be accurate from the logic above.
  if (oldProductsTableExistsAsRenamed) {
      console.log("Dropping old 'products_old_v1' table.");
      await db.runAsync(`DROP TABLE IF EXISTS products_old_v1;`);
  }
  if (oldQuantityHistoryTableExistsAsRenamed) { 
      console.log("Dropping old 'quantity_history_old_v1' table.");
      await db.runAsync(`DROP TABLE IF EXISTS quantity_history_old_v1;`);
  }
}