import * as SQLite from "expo-sqlite";

export async function migrateToV2(db: SQLite.SQLiteDatabase) {
    console.log("Migrating to V2: Refactor products, add categories, new inventory/shopping tables.");

    // All operations within a single transaction for atomicity
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
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
          updatedAt TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE,
          FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
        );
      `);
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS inventory_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listId INTEGER NOT NULL,
          productId INTEGER NOT NULL,
          date TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          notes TEXT,
          createdAt TEXT NOT NULL,
          UNIQUE(productId, date),
          FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE,
          FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
        );
      `);
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS shopping_list_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listId INTEGER NOT NULL,
          productId INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          checked INTEGER NOT NULL DEFAULT 0,
          price REAL,
          sortOrder INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE,
          FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
        );
      `);

    // 2. Data Migration & Table Renames/Transforms for 'products' and 'quantity_history'

    // Rename old 'products' table to a temporary name (if it exists)
    // This is crucial for maintaining data during complex schema changes
    const productsTableExists = (await db.getFirstSync(`SELECT name FROM sqlite_master WHERE type='table' AND name='products';`)) !== undefined;
    if (productsTableExists) {
        console.log("Renaming old 'products' table to 'products_old_v1' for migration.");
        await db.runAsync(`ALTER TABLE products RENAME TO products_old_v1;`);
    }

    // Create the new 'products' table with the updated schema (if it doesn't already exist)
    // This CREATE TABLE statement is the new definition for the 'products' entity.
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

    // Migrate data from 'products_old_v1' to 'products'
    if (productsTableExists) {
        console.log("Migrating data from 'products_old_v1' to new 'products'.");
        // Assuming 'name' is the only common direct column you want to preserve in 'products'
        await db.runAsync(`
              INSERT OR IGNORE INTO products (name, createdAt, updatedAt)
              SELECT name, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
              FROM products_old_v1;
          `);
    }

    // Migrate data from 'products_old_v1' to 'inventory_items'
    // This takes the 'quantity' and 'listId' from old 'products' to new 'inventory_items'
    if (productsTableExists) {
        console.log("Migrating data from 'products_old_v1' to 'inventory_items'.");
        await db.runAsync(`
              INSERT INTO inventory_items (listId, productId, quantity, sortOrder, createdAt, updatedAt)
              SELECT
                  pov.listId, -- Old listId
                  np.id,      -- New product ID
                  pov.quantity,
                  pov.\`order\`, -- Old order column
                  strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                  strftime('%Y-%m-%dT%H:%M:%fZ','now')
              FROM products_old_v1 pov
              JOIN products np ON pov.name = np.name;
          `);
    }

    // Rename old 'quantity_history' table to a temporary name
    const quantityHistoryTableExists = (await db.getFirstSync(`SELECT name FROM sqlite_master WHERE type='table' AND name='quantity_history';`)) !== undefined;
    if (quantityHistoryTableExists) {
        console.log("Renaming old 'quantity_history' table to 'quantity_history_old_v1' for migration.");
        await db.runAsync(`ALTER TABLE quantity_history RENAME TO quantity_history_old_v1;`);

        // Migrate data from 'quantity_history_old_v1' to 'inventory_history'
        console.log("Migrating data from 'quantity_history_old_v1' to new 'inventory_history'.");
        await db.runAsync(`
              INSERT INTO inventory_history (listId, productId, date, quantity, createdAt)
              SELECT
                  pov.listId,
                  np.id,
                  qhov.date,
                  qhov.quantity,
                  strftime('%Y-%m-%dT%H:%M:%fZ','now')
              FROM quantity_history_old_v1 qhov
              JOIN products_old_v1 pov ON qhov.productId = pov.id
              JOIN products np ON pov.name = np.name;
          `);
    }


    // 3. Clean up old tables (optional, but good practice after successful migration)
    if (productsTableExists) {
        console.log("Dropping old 'products_old_v1' table.");
        await db.runAsync(`DROP TABLE IF EXISTS products_old_v1;`);
    }
    if (quantityHistoryTableExists) {
        console.log("Dropping old 'quantity_history_old_v1' table.");
        await db.runAsync(`DROP TABLE IF EXISTS quantity_history_old_v1;`);
    }

}
