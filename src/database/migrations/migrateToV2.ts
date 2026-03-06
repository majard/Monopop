import * as SQLite from "expo-sqlite";

export async function migrateToV2(db: SQLite.SQLiteDatabase) {
  await db.runAsync('PRAGMA foreign_keys = OFF;');

  console.log("Migrating to V2: Refactor products, add categories, new inventory/shopping tables.");

  // --- Helper to get or create a default list ---
  async function getDefaultListId(): Promise<number> {
    const defaultList = await db.getFirstAsync<{ id: number }>('SELECT id FROM lists ORDER BY `order` ASC LIMIT 1;');
    if (defaultList) return defaultList.id;

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
    if (!result.lastInsertRowId) throw new Error("Failed to create default list during migration.");
    return result.lastInsertRowId;
  }


  // --- 1. Create new tables ---

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

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

  // --- 2. Migrate products ---

  const oldProductsExists = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='products_old_v1';`)) !== null;
  const newProductsExists = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='products';`)) !== null;

  if (newProductsExists && !oldProductsExists) {
    // First run: rename old products table
    await db.runAsync(`ALTER TABLE products RENAME TO products_old_v1;`);
  }

  // Create new products table
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

  const newProductsCount = (await db.getFirstAsync<{'COUNT(*)': number}>(`SELECT COUNT(*) FROM products;`))?.['COUNT(*)'] ?? 0;
  if (newProductsCount === 0) {
    await db.runAsync(`
      INSERT OR IGNORE INTO products (name, createdAt, updatedAt)
      SELECT name, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
      FROM products_old_v1;
    `);
  }

  const inventoryItemsCount = (await db.getFirstAsync<{'COUNT(*)': number}>(`SELECT COUNT(*) FROM inventory_items;`))?.['COUNT(*)'] ?? 0;
  const oldProductsCount = (await db.getFirstAsync<{'COUNT(*)': number}>(`SELECT COUNT(*) FROM products_old_v1;`))?.['COUNT(*)'] ?? 0;

  if (inventoryItemsCount < oldProductsCount) {
    await db.runAsync(`
      INSERT OR IGNORE INTO inventory_items (listId, productId, quantity, sortOrder, createdAt, updatedAt)
      SELECT
        pov.listId,  -- Use the listId from products_old_v1
        np.id,         -- New product ID
        pov.quantity,
        pov.\`order\`, -- Old 'order' column from products_old_v1
        strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        strftime('%Y-%m-%dT%H:%M:%fZ','now')
      FROM products_old_v1 pov
      JOIN products np ON pov.name = np.name;
    `);
  }

  // --- 3. Migrate quantity_history ---

  const originalQHExists = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history';`)) !== null;
  const renamedQHExists = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history_old_v1';`)) !== null;

  if (originalQHExists && !renamedQHExists) {
    await db.runAsync(`ALTER TABLE quantity_history RENAME TO quantity_history_old_v1;`);
  }

  const historyPopulated = (await db.getFirstAsync<{'COUNT(*)': number}>(`SELECT COUNT(*) FROM inventory_history;`))?.['COUNT(*)'] ?? 0;
  const qhOldExists = (await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history_old_v1';`)) !== null;

  if (qhOldExists && historyPopulated === 0) {
    await db.runAsync(`
      INSERT OR IGNORE INTO inventory_history (inventoryItemId, date, quantity, createdAt)
      SELECT
        ii.id,
        qhov.date,
        qhov.quantity,
        strftime('%Y-%m-%dT%H:%M:%fZ','now')
      FROM quantity_history_old_v1 qhov
      JOIN products_old_v1 pov ON qhov.productId = pov.id
      JOIN products np ON pov.name = np.name
      JOIN inventory_items ii ON ii.productId = np.id;
    `);
  }

  // --- 4. Clean up old tables ---
  await db.runAsync(`DROP TABLE IF EXISTS products_old_v1;`);
  await db.runAsync(`DROP TABLE IF EXISTS quantity_history_old_v1;`);

  await db.runAsync('PRAGMA foreign_keys = ON;');
}