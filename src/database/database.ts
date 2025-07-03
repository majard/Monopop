import * as SQLite from "expo-sqlite";
import { Product, InventoryItem, InventoryHistory, List, ShoppingListItem, Category } from "./models";
import { CURRENT_DATABASE_VERSION, runMigrations } from "./migrations";

let db: SQLite.SQLiteDatabase | null = null;

export const initializeDatabase = async (
  databaseName: string = "listai.db"
): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(databaseName);

    try {
      const result = db.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
      const currentVersion = result ? result.user_version : 0;

      if (currentVersion < CURRENT_DATABASE_VERSION) {
        console.log(`Migrating database from v${currentVersion} to v${CURRENT_DATABASE_VERSION}...`);
        await runMigrations(db, currentVersion);
        await db.runAsync(`PRAGMA user_version = ${CURRENT_DATABASE_VERSION};`);
        console.log('Database migration complete.');
      } else {
        console.log('Database is already up to date.');
      }

    } catch (error) {
      console.error("Error during database initialization or migration:", error);
      throw error;
    }
  }
  return db;
};

export const getDb = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error(
      "Database has not been initialized. Call initializeDatabase() first."
    );
  }
  return db;
};

// --- LIST CRUD OPERATIONS ---

export const addList = async (
  name: string,
  order: number = 0
): Promise<number> => {
  const db = getDb();
  try {
    const existingList = db.getFirstSync<{ id: number }>(
      "SELECT id FROM lists WHERE name = ?",
      [name.trim()]
    );

    if (existingList) {
      return existingList.id;
    }

    const result = await db.runAsync("INSERT INTO lists (name, `order`) VALUES (?, ?);", [
      name.trim(),
      order,
    ]);

    if (result.lastInsertRowId) {
      return result.lastInsertRowId;
    } else {
      throw new Error("Failed to get ID of inserted list.");
    }
  } catch (error: any) {
    console.error("Error adding list:", error);
    throw new Error(error.message || "Unknown error adding list.");
  }
};

export const getLists = async (): Promise<List[]> => { 
  const db = getDb();
  try {
    const result = await db.getAllAsync<List>(
      "SELECT * FROM lists ORDER BY `order` ASC;"
    );
    return result;
  } catch (error) {
    console.error("Error getting lists:", error);
    throw error;
  }
};

export const getListById = async (id: number): Promise<List | undefined> => { // Changed to async/await
  const db = getDb();
  try {
    const result = await db.getFirstAsync<List>( // Changed to async
      "SELECT * FROM lists WHERE id = ?;",
      [id]
    );
    return result;
  } catch (error) {
    console.error("Error getting list by ID:", error);
    throw error;
  }
};

export const updateListName = async (id: number, name: string): Promise<void> => { // Changed to async/await
  const db = getDb();
  try {
    await db.runAsync(
      `UPDATE lists SET name = ? WHERE id = ?;`,
      [name.trim(), id]
    );
  } catch (error) {
    console.error("Error updating list name:", error);
    throw error;
  }
};

export const deleteList = async (id: number): Promise<void> => { // Changed to async/await
  const db = getDb();
  try {
    await db.runAsync(`DELETE FROM lists WHERE id = ?;`, [id]);
  } catch (error) {
    console.error("Error deleting list:", error);
    throw error;
  }
};

export const updateListOrder = async ( // New function to consolidate updateInventoryItemOrder's logic
  updates: { id: number; order: number }[]
): Promise<void> => {
  const db = getDb();
  await db.withTransactionAsync(async () => { // Use transactionAsync for atomicity
    for (const { id, order } of updates) {
      await db.runAsync(
        "UPDATE lists SET `sortOrder` = ? WHERE id = ?",
        [order, id]
      );
    }
  });
};


// --- PRODUCT CRUD OPERATIONS ---

export const addProduct = async (
  name: string,
  categoryId?: number,
): Promise<number> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    const existingProduct = db.getFirstSync<{ id: number }>(
      "SELECT id FROM products WHERE name = ?",
      [name.trim()]
    );

    if (existingProduct) {
      return existingProduct.id;
    }

    const result = await db.runAsync(
      "INSERT INTO products (name, categoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      [name.trim(), categoryId, now, now]
    );

    if (result.lastInsertRowId) {
      return result.lastInsertRowId;
    } else {
      throw new Error("Failed to get inserted product ID");
    }
  } catch (error: any) {
    console.error("Error adding product:", error);
    throw new Error(error.message || "Unknown error adding product.");
  }
};

export const getProducts = async (): Promise<Product[]> => {
  const db = getDb();
  try {
    const result = await db.getAllAsync<Product>(
      "SELECT * FROM products ORDER BY name ASC;" 
    );
    return result;
  } catch (error: any) {
    console.error("Error getting products:", error);
    throw error;
  }
};

export const getProductById = async (id: number): Promise<Product | undefined> => { // Added get by ID
  const db = getDb();
  try {
    const result = await db.getFirstAsync<Product>(
      "SELECT * FROM products WHERE id = ?;",
      [id]
    );
    return result;
  } catch (error) {
    console.error("Error getting product by ID:", error);
    throw error;
  }
};

export const updateProductName = async (id: number, name: string): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.runAsync(
      `UPDATE products SET name = ?, updatedAt = ? WHERE id = ?;`,
      [name.trim(), now, id]
    );
  } catch (error) {
    console.error("Error updating product name:", error);
    throw error;
  }
};

export const deleteProduct = async (id: number): Promise<void> => {
  const db = getDb();
  try {
    await db.runAsync("DELETE FROM products WHERE id = ?", [id]);
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
};

// --- INVENTORY ITEM CRUD OPERATIONS ---

export const addInventoryItem = async (
  listId: number,
  productId: number,
  quantity: number,
  sortOrder: number = 0,
  notes?: string
): Promise<number> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    // Check if an inventory item for this product already exists in this specific list
    const existingItem = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM inventory_items WHERE listId = ? AND productId = ?",
      [listId, productId]
    );

    if (existingItem) {
      // If it exists, update its quantity and notes
      await db.runAsync(
        "UPDATE inventory_items SET quantity = ?, notes = ?, updatedAt = ? WHERE id = ?;",
        [quantity, notes, now, existingItem.id]
      );
      return existingItem.id;
    } else {
      // Insert new inventory item
      const result = await db.runAsync(
        "INSERT INTO inventory_items (listId, productId, quantity, sortOrder, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?);",
        [listId, productId, quantity, sortOrder, notes, now, now]
      );

      if (result.lastInsertRowId) {
        return result.lastInsertRowId;
      } else {
        throw new Error("Failed to get ID of inserted inventory item.");
      }
    }
  } catch (error: any) {
    console.error("Error adding inventory item:", error);
    throw new Error(error.message || "Unknown error adding inventory item.");
  }
};

export const getInventoryItems = async (listId: number): Promise<InventoryItem[]> => {
  const db = getDb();
  try {
    const result = await db.getAllAsync<InventoryItem>(
      "SELECT * FROM inventory_items WHERE listId = ? ORDER BY sortOrder ASC;",
      [listId]
    );
    return result;
  } catch (error: any) {
    console.error("Error getting inventory items:", error);
    throw error;
  }
};

export const updateInventoryItemQuantity = async (
  id: number,
  newQuantity: number
): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.runAsync("UPDATE inventory_items SET quantity = ?, updatedAt = ? WHERE id = ?", [
      newQuantity,
      now,
      id,
    ]);
  } catch (error) {
    console.error("Error updating inventory item quantity:", error);
    throw error;
  }
};

export const updateInventoryItemOrder = async (
  updates: { id: number; sortOrder: number }[]
): Promise<void> => {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const { id, sortOrder } of updates) {
      await db.runAsync(
        "UPDATE inventory_items SET sortOrder = ? WHERE id = ?",
        [sortOrder, id]
      );
    }
  });
};

export const deleteInventoryItem = async (id: number): Promise<void> => {
  const db = getDb();
  try {
    await db.runAsync("DELETE FROM inventory_items WHERE id = ?", [id]);
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    throw error;
  }
};

export const updateInventoryItemProductList = async (
  inventoryItemId: number,
  newListId: number
): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.runAsync(
      `UPDATE inventory_items SET listId = ?, updatedAt = ? WHERE id = ?;`,
      [newListId, now, inventoryItemId]
    );
  } catch (error) {
    console.error("Error updating inventory item's listId:", error);
    throw error;
  }
};

// --- INVENTORY HISTORY CRUD OPERATIONS --- (Replacing quantity_history functions)

export const getInventoryHistory = async (
  inventoryItemId: number
): Promise<InventoryHistory[]> => {
  const db = getDb();
  try {
    let query = `SELECT * FROM inventory_history WHERE inventoryItemId = ?`;
    let params: (number | string)[] = [inventoryItemId];

    query += ` ORDER BY date DESC;`;

    const result = await db.getAllAsync<InventoryHistory>(query, params);
    return result;
  } catch (error: any) {
    console.error("Error fetching inventory history:", error);
    throw error;
  }
};

export const saveInventorySnapshotHistory = async ( // Renamed from saveProductHistory
  inventoryItemId: number,
  overrideDate?: Date
): Promise<void> => {
  const db = getDb();
  const now = overrideDate ? overrideDate : new Date();
  const dateToSave = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const createdAt = now.toISOString();

  await db.withTransactionAsync(async () => {
    // Get current inventory items for the given list
    const currentInventory = await db.getAllAsync<{ productId: number; quantity: number }>(
      `SELECT productId, quantity FROM inventory_items WHERE inventoryItemId = ?;`,
      [inventoryItemId]
    );

    for (const item of currentInventory) {
      const existingEntry = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM inventory_history WHERE inventoryItemId = ? AND date = ?;`,
        [inventoryItemId, dateToSave]
      );

      if (existingEntry) {
        await db.runAsync(
          `UPDATE inventory_history SET quantity = ?, createdAt = ? WHERE id = ?;`,
          [item.quantity, createdAt, existingEntry.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO inventory_history (inventoryItemId, quantity, date, createdAt) VALUES (?, ?, ?, ?);`,
          [inventoryItemId, item.quantity, dateToSave, createdAt]
        );
      }
    }
  });
};

export const addSingleInventoryHistoryEntry = async ( // Renamed from saveProductHistoryForSingleProduct
  inventoryItemId: number,
  quantity: number,
  date: Date,
  notes?: string
): Promise<void> => {
  const db = getDb();
  const dateToSave = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const createdAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const existingEntry = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM inventory_history WHERE inventoryItemId = ? AND date = ?;`,
      [inventoryItemId, dateToSave]
    );

    if (existingEntry) {
      await db.runAsync(
        `UPDATE inventory_history SET quantity = ?, notes = ?, createdAt = ? WHERE id = ?;`,
        [quantity, notes, createdAt, existingEntry.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO inventory_history (inventoryItemId, quantity, date, notes, createdAt) VALUES (?, ?, ?, ?, ?);`,
        [inventoryItemId, quantity, dateToSave, notes, createdAt]
      );
    }
  });
};

export const consolidateProductHistory = async (
  sourceProductId: number,
  targetProductId: number,
  listId: number // Added listId as inventory_history now requires it
): Promise<void> => {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Delete any existing history for target product for today in the specific list
    await db.runAsync(
      `DELETE FROM inventory_history WHERE productId = ? AND listId = ? AND date = ?;`,
      [targetProductId, listId, today]
    );

    // 2. Transfer history from source to target, ensuring listId is consistent
    await db.runAsync(`
      INSERT INTO inventory_history (listId, productId, quantity, date, notes, createdAt)
      SELECT ?, ?, quantity, date, notes, ?
      FROM inventory_history
      WHERE productId = ?;
    `, [listId, targetProductId, now, sourceProductId]);

    // 3. Delete the source product's history entries
    await db.runAsync(`DELETE FROM inventory_history WHERE productId = ?;`, [sourceProductId]);

    // 4. Delete the source product from the products table (this will cascade delete related inventory/shopping items)
    await db.runAsync(`DELETE FROM products WHERE id = ?;`, [sourceProductId]);
  });
};

// --- CATEGORY CRUD OPERATIONS ---

export const addCategory = async (name: string): Promise<number> => {
  const db = getDb();
  try {
    const existingCategory = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE name = ?",
      [name.trim()]
    );

    if (existingCategory) {
      return existingCategory.id;
    }

    const result = await db.runAsync("INSERT INTO categories (name) VALUES (?);", [name.trim()]);
    if (result.lastInsertRowId) {
      return result.lastInsertRowId;
    } else {
      throw new Error("Failed to get ID of inserted category.");
    }
  } catch (error: any) {
    console.error("Error adding category:", error);
    throw new Error(error.message || "Unknown error adding category.");
  }
};

export const getCategories = async (): Promise<Category[]> => {
  const db = getDb();
  try {
    const result = await db.getAllAsync<Category>("SELECT * FROM categories ORDER BY name ASC;");
    return result;
  } catch (error) {
    console.error("Error getting categories:", error);
    throw error;
  }
};

// --- SHOPPING LIST ITEM CRUD OPERATIONS ---

export const addShoppingListItem = async (
  listId: number,
  productId: number,
  quantity: number,
  price?: number,
  notes?: string,
  sortOrder: number = 0
): Promise<number> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    const existingItem = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM shopping_list_items WHERE listId = ? AND productId = ?;`,
      [listId, productId]
    );

    if (existingItem) {
      await db.runAsync(
        `UPDATE shopping_list_items SET quantity = ?, price = ?, notes = ?, updatedAt = ? WHERE id = ?;`,
        [quantity, price, notes, now, existingItem.id]
      );
      return existingItem.id;
    } else {
      const result = await db.runAsync(
        `INSERT INTO shopping_list_items (listId, productId, quantity, checked, price, sortOrder, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [listId, productId, quantity, 0, price, sortOrder, notes, now, now]
      );
      if (result.lastInsertRowId) {
        return result.lastInsertRowId;
      } else {
        throw new Error("Failed to get ID of inserted shopping list item.");
      }
    }
  } catch (error: any) {
    console.error("Error adding shopping list item:", error);
    throw new Error(error.message || "Unknown error adding shopping list item.");
  }
};

export const getShoppingListItemsByListId = async (listId: number): Promise<ShoppingListItem[]> => {
  const db = getDb();
  try {
    const result = await db.getAllAsync<ShoppingListItem>(
      `SELECT * FROM shopping_list_items WHERE listId = ? ORDER BY sortOrder ASC;`,
      [listId]
    );
    return result;
  } catch (error) {
    console.error("Error getting shopping list items:", error);
    throw error;
  }
};

export const updateShoppingListItem = async (
  id: number,
  updates: { quantity?: number; checked?: boolean; price?: number; sortOrder?: number; notes?: string }
): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();
  let query = `UPDATE shopping_list_items SET updatedAt = ?`;
  const params: (string | number | boolean | undefined)[] = [now];

  if (updates.quantity !== undefined) { query += `, quantity = ?`; params.push(updates.quantity); }
  if (updates.checked !== undefined) { query += `, checked = ?`; params.push(updates.checked ? 1 : 0); }
  if (updates.price !== undefined) { query += `, price = ?`; params.push(updates.price); }
  if (updates.sortOrder !== undefined) { query += `, sortOrder = ?`; params.push(updates.sortOrder); }
  if (updates.notes !== undefined) { query += `, notes = ?`; params.push(updates.notes); }

  query += ` WHERE id = ?;`;
  params.push(id);

  try {
    await db.runAsync(query, params);
  } catch (error) {
    console.error("Error updating shopping list item:", error);
    throw error;
  }
};

export const deleteShoppingListItem = async (id: number): Promise<void> => {
  const db = getDb();
  try {
    await db.runAsync(`DELETE FROM shopping_list_items WHERE id = ?;`, [id]);
  } catch (error) {
    console.error("Error deleting shopping list item:", error);
    throw error;
  }
};