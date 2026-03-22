import * as SQLite from "expo-sqlite";
import { Product, InventoryItem, InventoryHistory, List, ShoppingListItem, Category } from "./models";
import { CURRENT_DATABASE_VERSION, runMigrations } from "./migrations";

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const initializeDatabase = async (
  databaseName: string = "listai.db"
): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      db = await SQLite.openDatabaseAsync(databaseName);

      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA synchronous = NORMAL;');
      await db.execAsync('PRAGMA temp_store = memory;');
      await db.execAsync('PRAGMA cache_size = -8000;');
      await db.execAsync('PRAGMA foreign_keys = ON;');

      const result = db.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
      const currentVersion = result ? result.user_version : 0;

      if (currentVersion < CURRENT_DATABASE_VERSION) {
        console.log(`Migrating database from v${currentVersion} to v${CURRENT_DATABASE_VERSION}...`);
        await runMigrations(db, currentVersion);
        db = await SQLite.openDatabaseAsync(databaseName);
        await db.execAsync('PRAGMA foreign_keys = ON;');
        console.log('Database migration complete.');
      } else {
        console.log('Database is already up to date.');
      }

      return db;
    } catch (error) {
      db = null;
      initPromise = null;
      console.error("Error during database initialization or migration:", error);
      throw error;
    }
  })();

  return initPromise;
};


export const getDb = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error(
      "Database has not been initialized. Call initializeDatabase() first."
    );
  }
  return db;
};

const normalizeStoreName = (name: string) => name.trim().replace(/\s+/g, " ");

export const getStores = async (): Promise<{ id: number; name: string }[]> => {
  const db = getDb();
  try {
    return await db.getAllAsync<{ id: number; name: string }>(
      `SELECT id, name FROM stores ORDER BY name ASC;`
    );
  } catch (error) {
    console.error("Error getting stores:", error);
    throw error;
  }
};

export const addStore = async (name: string): Promise<number> => {
  const db = getDb();
  const normalized = normalizeStoreName(name);
  if (!normalized) {
    throw new Error("Store name is required");
  }

  try {
    const existing = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM stores WHERE name = ?;`,
      [normalized]
    );
    if (existing?.id) return existing.id;

    const result = await db.runAsync(`INSERT INTO stores (name) VALUES (?);`, [normalized]);
    if (!result.lastInsertRowId) {
      throw new Error("Failed to create store");
    }
    return result.lastInsertRowId;
  } catch (error) {
    console.error("Error adding store:", error);
    throw error;
  }
};

export const getLastStoreName = async (): Promise<string | null> => {
  const db = getDb();
  try {
    const row = await db.getFirstAsync<{ name: string }>(
      `SELECT s.name
       FROM invoices i
       JOIN stores s ON i.storeId = s.id
       ORDER BY i.createdAt DESC
       LIMIT 1;`
    );
    return row?.name ?? null;
  } catch (error) {
    console.error("Error getting last store name:", error);
    throw error;
  }
};

export const getLastUnitPriceForProduct = async (productId: number): Promise<number | null> => {
  const db = getDb();
  try {
    const row = await db.getFirstAsync<{ unitPrice: number }>(
      `SELECT unitPrice
       FROM invoice_items
       WHERE productId = ? AND unitPrice IS NOT NULL
       ORDER BY createdAt DESC
       LIMIT 1;`,
      [productId]
    );
    return row?.unitPrice ?? null;
  } catch (error) {
    console.error("Error getting last unit price for product:", error);
    throw error;
  }
};

export const getLastUnitPriceForProductAtStore = async (productId: number, storeId: number): Promise<number | null> => {
  const db = getDb();
  try {
    const row = await db.getFirstAsync<{ unitPrice: number }>(
      `SELECT ii.unitPrice 
       FROM invoice_items ii
       INNER JOIN invoices i ON ii.invoiceId = i.id
       WHERE ii.productId = ? AND i.storeId = ?
       ORDER BY ii.createdAt DESC 
       LIMIT 1`,
      [productId, storeId]
    );
    return row?.unitPrice || null;
  } catch (error) {
    console.error('Error getting last unit price for product at store:', error);
    return null;
  }
};

export const getLastUnitPricesForProductsAtStore = async (productIds: number[], storeId: number): Promise<Map<number, number>> => {
  if (productIds.length === 0) return new Map();

  const db = getDb();
  try {
    const placeholders = productIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ productId: number; unitPrice: number }>(
      `SELECT ii.productId, ii.unitPrice 
       FROM invoice_items ii
       INNER JOIN invoices i ON ii.invoiceId = i.id
       WHERE ii.productId IN (${placeholders}) AND i.storeId = ? AND ii.unitPrice IS NOT NULL
       ORDER BY ii.productId, i.createdAt DESC`,
      [...productIds, storeId]
    );

    const priceMap = new Map<number, number>();
    const seenProducts = new Set<number>();

    for (const row of rows) {
      if (!seenProducts.has(row.productId)) {
        priceMap.set(row.productId, row.unitPrice);
        seenProducts.add(row.productId);
      }
    }

    return priceMap;
  } catch (error) {
    console.error('Error getting last unit prices for products at store:', error);
    throw error;
  }
};

export const getLastUnitPricesForProducts = async (productIds: number[]): Promise<Map<number, number>> => {
  if (productIds.length === 0) return new Map();

  const db = getDb();
  try {
    const placeholders = productIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ productId: number; unitPrice: number }>(
      `SELECT productId, unitPrice
       FROM invoice_items
       WHERE productId IN (${placeholders}) AND unitPrice IS NOT NULL
       ORDER BY productId, createdAt DESC`,
      productIds
    );

    const priceMap = new Map<number, number>();
    const seenProducts = new Set<number>();

    for (const row of rows) {
      if (!seenProducts.has(row.productId)) {
        priceMap.set(row.productId, row.unitPrice);
        seenProducts.add(row.productId);
      }
    }

    return priceMap;
  } catch (error) {
    console.error('Error getting last unit prices for products:', error);
    throw error;
  }
};

export const ensureStoreExists = async (db: SQLite.SQLiteDatabase, storeName: string): Promise<number> => {
  const normalized = normalizeStoreName(storeName);
  if (!normalized) {
    throw new Error("Store name is required");
  }

  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM stores WHERE name = ?;`,
    [normalized]
  );
  if (existing?.id) return existing.id;

  const result = await db.runAsync(`INSERT INTO stores (name) VALUES (?);`, [normalized]);
  if (!result.lastInsertRowId) {
    throw new Error("Failed to create store");
  }
  return result.lastInsertRowId;
};

// --- LIST CRUD OPERATIONS ---

export const addList = async (
  name: string,
  order: number = 0
): Promise<number> => {
  const db = getDb();
  try {
    const existingList = await db.getFirstAsync<{ id: number }>(
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

export const getListById = async (id: number): Promise<List | undefined> => {
  const db = getDb();
  try {
    const result = await db.getFirstAsync<List>(
      "SELECT * FROM lists WHERE id = ?;",
      [id]
    );
    return result;
  } catch (error) {
    console.error("Error getting list by ID:", error);
    throw error;
  }
};

export const updateListName = async (id: number, name: string): Promise<void> => {
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

export const deleteList = async (id: number): Promise<void> => {
  const db = getDb();
  try {
    await db.runAsync(`DELETE FROM lists WHERE id = ?;`, [id]);
  } catch (error) {
    console.error("Error deleting list:", error);
    throw error;
  }
};

// Renamed and adjusted to fit lists table structure better if sorting is for lists
export const updateListOrder = async (
  updates: { id: number; order: number }[]
): Promise<void> => {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const { id, order } of updates) {
      await db.runAsync(
        "UPDATE lists SET `order` = ? WHERE id = ?", // Assuming 'order' column exists for lists
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
    const existingProduct = await db.getFirstAsync<{ id: number }>(
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
      "SELECT p.*, c.name as categoryName FROM products p LEFT JOIN categories c ON p.categoryId = c.id ORDER BY p.name ASC;"
    );
    return result;
  } catch (error: any) {
    console.error("Error getting products:", error);
    throw error;
  }
};

export const getProductById = async (id: number): Promise<Product | undefined> => {
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
      `SELECT
      ii.*,
      p.name AS productName,
      p.categoryId,
      c.name AS categoryName
      FROM inventory_items ii
      JOIN products p ON ii.productId = p.id
      LEFT JOIN categories c ON p.categoryId = c.id
      WHERE ii.listId = ?
      ORDER BY ii.sortOrder ASC;`,
      [listId]
    );
    return result;
  } catch (error: any) {
    console.error("Error getting inventory items:", error);
    throw error;
  }
};

export const updateInventoryItem = async (
  id: number,
  newQuantity?: number,
  newNotes?: string
): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();

  let query = `UPDATE inventory_items SET updatedAt = ?`;
  const params: (string | number | boolean | undefined)[] = [now];

  if (newQuantity !== undefined) { query += `, quantity = ?`; params.push(newQuantity); }
  if (newNotes !== undefined) { query += `, notes = ?`; params.push(newNotes); }

  query += ` WHERE id = ?;`;
  params.push(id);
  try {
    await db.runAsync(query, params);
  } catch (error) {
    console.error("Error updating inventory item:", error);
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

export const updateInventoryItemList = async (
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

// --- INVENTORY HISTORY CRUD OPERATIONS ---

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

export const saveInventoryHistorySnapshot = async (
  inventoryItemId: number,
  quantityToSave?: number,
  overrideDate?: Date
): Promise<void> => {
  const db = getDb();
  const now = overrideDate ? overrideDate : new Date();
  const dateToSave = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const createdAt = now.toISOString();

  await db.withTransactionAsync(async () => {
    // Get the current quantity of the specific inventory item
    const currentInventoryItem = await db.getFirstAsync<{ quantity: number }>(
      `SELECT quantity FROM inventory_items WHERE id = ?;`,
      [inventoryItemId]
    );


    if (!currentInventoryItem) {
      console.warn(`Inventory item with ID ${inventoryItemId} not found. Cannot save history snapshot.`);
      return; // Or throw an error, depending on desired behavior
    }

    const existingEntry = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM inventory_history WHERE inventoryItemId = ? AND date LIKE ?;`,
      [inventoryItemId, `${dateToSave}%`]
    );

    if (existingEntry) {
      // If entry exists for today, update its quantity
      await db.runAsync(
        `UPDATE inventory_history SET quantity = ?, createdAt = ? WHERE id = ?;`,
        [quantityToSave !== undefined ? quantityToSave : currentInventoryItem.quantity, createdAt, existingEntry.id]
      );
    } else {
      // Otherwise, insert a new entry
      await db.runAsync(
        `INSERT INTO inventory_history (inventoryItemId, quantity, date, createdAt) VALUES (?, ?, ?, ?);`,
        [inventoryItemId, quantityToSave !== undefined ? quantityToSave : currentInventoryItem.quantity, dateToSave, createdAt]
      );
    }
  });
};

export const addSingleInventoryHistoryEntry = async (
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

    const result = await db.runAsync("INSERT INTO categories (name, createdAt, updatedAt) VALUES (?, ?, ?);",
      [name.trim(), new Date().toISOString(), new Date().toISOString()]);
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

export const getCategories = async (orderBy: 'name' | 'usage' = 'usage'): Promise<Category[]> => {
  const db = getDb();
  try {
    const query = orderBy === 'usage'
      ? `SELECT c.* FROM categories c
         LEFT JOIN products p ON p.categoryId = c.id
         GROUP BY c.id
         ORDER BY COUNT(p.id) DESC, c.name ASC;`
      : `SELECT * FROM categories ORDER BY name ASC;`;
    return await db.getAllAsync<Category>(query);
  } catch (error) {
    console.error("Error getting categories:", error);
    throw error;
  }
};

// --- SHOPPING LIST ITEM CRUD OPERATIONS ---

// Helper function to get or create a product and inventory item
// This function encapsulates the "ensure product/inventory item exists" logic.
const ensureProductAndInventoryItemExist = async (
  db: SQLite.SQLiteDatabase,
  listId: number,
  productName: string,
  categoryId?: number,
  initialInventoryQuantity: number = 0 // Default to 0 for inventory items created via shopping list
): Promise<{ productId: number; inventoryItemId: number }> => {
  let productId: number;
  let inventoryItemId: number;
  const now = new Date().toISOString();

  // 1. Get or create Product
  const existingProduct = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM products WHERE name = ?;`,
    [productName.trim()]
  );

  if (existingProduct) {
    productId = existingProduct.id;
  } else {
    const productResult = await db.runAsync(
      `INSERT INTO products (name, categoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?);`,
      [productName.trim(), categoryId, now, now]
    );
    if (!productResult.lastInsertRowId) {
      throw new Error(`Failed to create product '${productName}'`);
    }
    productId = productResult.lastInsertRowId;
  }

  // 2. Get or create InventoryItem for the given listId and productId
  const existingInventoryItem = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM inventory_items WHERE listId = ? AND productId = ?;`,
    [listId, productId]
  );

  if (existingInventoryItem) {
    inventoryItemId = existingInventoryItem.id;
  } else {
    const inventoryResult = await db.runAsync(
      `INSERT INTO inventory_items (listId, productId, quantity, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?);`,
      [listId, productId, initialInventoryQuantity, now, now] // Set initial quantity to 0
    );
    if (!inventoryResult.lastInsertRowId) {
      throw new Error(`Failed to create inventory item for product ${productName} in list ${listId}`);
    }
    inventoryItemId = inventoryResult.lastInsertRowId;
  }

  return { productId, inventoryItemId };
};


export const addShoppingListItem = async (
  listId: number,       // Needed for ensureProductAndInventoryItemExist
  productName: string,  // Added productName to allow creating product/inventory item if not exists
  quantity: number,
  price?: number,
  notes?: string,
  sortOrder: number = 0,
  categoryId?: number // Added categoryId for new product creation
): Promise<number> => {
  const db = getDb();
  const now = new Date().toISOString();

  try {
    // Ensure the Product and InventoryItem exist for this list
    const { inventoryItemId, productId } = await ensureProductAndInventoryItemExist(db, listId, productName, categoryId, 0);

    if (!price) {
      price = await getLastUnitPriceForProduct(productId);
      console.log("Last unit price for product:", price);
    }
    // Check if a shopping list item for this specific inventoryItemId already exists
    // (There should only be one shopping list item for a unique inventory item due to UNIQUE constraint)
    const existingShoppingItem = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM shopping_list_items WHERE inventoryItemId = ?;`,
      [inventoryItemId]
    );

    if (existingShoppingItem) {
      // If it exists, update its quantity and other details
      await db.runAsync(
        `UPDATE shopping_list_items SET quantity = ?, price = ?, notes = ?, updatedAt = ? WHERE id = ?;`,
        [quantity, price, notes, now, existingShoppingItem.id]
      );
      return existingShoppingItem.id;
    } else {
      // Insert new shopping list item linked to the inventoryItemId
      const result = await db.runAsync(
        `INSERT INTO shopping_list_items (inventoryItemId, quantity, checked, price, sortOrder, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [inventoryItemId, quantity, 0, price, sortOrder, notes, now, now]
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
    // We need to JOIN to inventory_items to filter by listId,
    // and then JOIN to products to get product details for display if needed
    const result = await db.getAllAsync<ShoppingListItem>(
      `SELECT
          sli.id,
          sli.inventoryItemId,
          sli.quantity,
          sli.checked,
          sli.price,
          sli.sortOrder,
          sli.notes,
          sli.createdAt,
          sli.updatedAt,
          p.name AS productName,       -- Add product name for convenience
          ii.productId AS productId,    -- Add productId for convenience
          ii.quantity AS currentInventoryQuantity, -- Add current inventory quantity
          c.name AS categoryName        -- Add category name for convenience
       FROM shopping_list_items sli
       JOIN inventory_items ii ON sli.inventoryItemId = ii.id
       JOIN products p ON ii.productId = p.id
       LEFT JOIN categories c ON p.categoryId = c.id
       WHERE ii.listId = ?
       ORDER BY sli.sortOrder ASC;`,
      [listId]
    );
    // We might want to extend our ShoppingListItem model to include productName and productId
    // if we return them directly from this query.
    return result;
  } catch (error) {
    console.error("Error getting shopping list items:", error);
    throw error;
  }
};

export const updateShoppingListItem = async (
  id: number, // ShoppingListItem ID
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

/**
 * Buy a shopping list item by adding its quantity to the corresponding inventory item,
 * writing a history entry, and removing the item from the shopping list.
 * 
 * @param shoppingListItemId The ID of the shopping list item to buy.
 * @param purchasedQuantity Optional: the quantity to purchase. If null/undefined, uses the quantity from the shopping list item.
 * @returns A promise that resolves when the operation is complete.
 */
export const buyShoppingListItem = async (
  shoppingListItemId: number,
  purchasedQuantity?: number // Optional: if null/undefined, use the quantity from the shopping list item
): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // 1. Get the shopping list item and its linked inventory_item
    const shoppingItem = await db.getFirstAsync<{
      inventoryItemId: number;
      quantity: number; // Quantity desired on shopping list
      checked: number; // SQLite returns 0 or 1 for boolean
    }>(
      `SELECT inventoryItemId, quantity, checked FROM shopping_list_items WHERE id = ?;`,
      [shoppingListItemId]
    );

    if (!shoppingItem) {
      throw new Error(`Shopping list item with ID ${shoppingListItemId} not found.`);
    }

    const { inventoryItemId } = shoppingItem;
    const qtyToPurchase = purchasedQuantity !== undefined ? purchasedQuantity : shoppingItem.quantity;

    // 2. Update the quantity in inventory_items
    await db.runAsync(
      `UPDATE inventory_items SET quantity = quantity + ?, updatedAt = ? WHERE id = ?;`,
      [qtyToPurchase, now, inventoryItemId]
    );

    // 3. Add an entry to inventory_history for the purchase
    const updatedInventoryItem = await db.getFirstAsync<{ quantity: number }>(
      `SELECT quantity FROM inventory_items WHERE id = ?;`,
      [inventoryItemId]
    );
    if (updatedInventoryItem) {
      await addSingleInventoryHistoryEntry(
        inventoryItemId,
        updatedInventoryItem.quantity,
        new Date(now),
        `Comprou ${qtyToPurchase} unidades (via Lista de Compras)`
      );
    }

    // 4. Delete the shopping list item (or update its quantity/checked status)
    if (qtyToPurchase >= shoppingItem.quantity) {
      await db.runAsync(`DELETE FROM shopping_list_items WHERE id = ?;`, [shoppingListItemId]);
    } else {
      await db.runAsync(
        `UPDATE shopping_list_items SET quantity = quantity - ?, updatedAt = ?, checked = 0 WHERE id = ?;`,
        [qtyToPurchase, now, shoppingListItemId]
      );
    }
  });
};

/** Conclude shopping for a list AND create an invoice (store required). Single transaction. */
export const concludeShoppingForListWithInvoice = async (
  listId: number,
  storeName: string,
  date?: Date
): Promise<{ invoiceId: number }> => {
  const db = getDb();
  const now = (date ?? new Date()).toISOString();
  const dateToSave = now.split('T')[0];

  let invoiceId = 0;
  await db.withTransactionAsync(async () => {
    const checkedItems = await db.getAllAsync<{
      id: number;
      inventoryItemId: number;
      productId: number;
      quantity: number;
      price: number | null;
    }>(
      `SELECT sli.id, sli.inventoryItemId, ii.productId, sli.quantity, sli.price
       FROM shopping_list_items sli
       JOIN inventory_items ii ON sli.inventoryItemId = ii.id
       WHERE ii.listId = ? AND sli.checked = 1;`,
      [listId]
    );

    if (checkedItems.length === 0) {
      throw new Error("No checked items to conclude.");
    }

    const storeId = await ensureStoreExists(db, storeName);

    const invoiceResult = await db.runAsync(
      `INSERT INTO invoices (storeId, listId, total, createdAt) VALUES (?, ?, ?, ?);`,
      [storeId, listId, 0, now]
    );
    if (!invoiceResult.lastInsertRowId) {
      throw new Error("Failed to create invoice.");
    }
    invoiceId = invoiceResult.lastInsertRowId;

    let total = 0;
    for (const row of checkedItems) {
      const unitPrice = row.price ?? null;
      const lineTotal = (unitPrice ?? 0) * row.quantity;
      total += lineTotal;

      await db.runAsync(
        `INSERT INTO invoice_items (invoiceId, productId, quantity, unitPrice, lineTotal, createdAt)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [invoiceId, row.productId, row.quantity, unitPrice, lineTotal, now]
      );
    }

    await db.runAsync(`UPDATE invoices SET total = ? WHERE id = ?;`, [total, invoiceId]);

    for (const row of checkedItems) {
      const { id: shoppingListItemId, inventoryItemId, quantity: qtyToPurchase } = row;

      await db.runAsync(
        `UPDATE inventory_items SET quantity = quantity + ?, updatedAt = ? WHERE id = ?;`,
        [qtyToPurchase, now, inventoryItemId]
      );

      const updatedInventoryItem = await db.getFirstAsync<{ quantity: number }>(
        `SELECT quantity FROM inventory_items WHERE id = ?;`,
        [inventoryItemId]
      );
      if (updatedInventoryItem) {
        const notes = `Comprou ${qtyToPurchase} unidades (via Lista de Compras)`;
        const existingEntry = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM inventory_history WHERE inventoryItemId = ? AND date = ?;`,
          [inventoryItemId, dateToSave]
        );
        if (existingEntry) {
          await db.runAsync(
            `UPDATE inventory_history SET quantity = ?, notes = ?, createdAt = ? WHERE id = ?;`,
            [updatedInventoryItem.quantity, notes, now, existingEntry.id]
          );
        } else {
          await db.runAsync(
            `INSERT INTO inventory_history (inventoryItemId, quantity, date, notes, createdAt) VALUES (?, ?, ?, ?, ?);`,
            [inventoryItemId, updatedInventoryItem.quantity, dateToSave, notes, now]
          );
        }
      }

      await db.runAsync(`DELETE FROM shopping_list_items WHERE id = ?;`, [shoppingListItemId]);
    }
  });

  if (!invoiceId) {
    throw new Error("Failed to create invoice.");
  }
  return { invoiceId };
};

/** Conclude shopping for a list: add all checked items' quantities to inventory, write history, then remove them from the shopping list. Single transaction. */
export const concludeShoppingForList = async (listId: number): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();

  const dateToSave = now.split('T')[0];

  await db.withTransactionAsync(async () => {
    const checkedItems = await db.getAllAsync<{
      id: number;
      inventoryItemId: number;
      quantity: number;
    }>(
      `SELECT sli.id, sli.inventoryItemId, sli.quantity
       FROM shopping_list_items sli
       JOIN inventory_items ii ON sli.inventoryItemId = ii.id
       WHERE ii.listId = ? AND sli.checked = 1;`,
      [listId]
    );

    for (const row of checkedItems) {
      const { id: shoppingListItemId, inventoryItemId, quantity: qtyToPurchase } = row;

      // 1. Update inventory quantity
      await db.runAsync(
        `UPDATE inventory_items SET quantity = quantity + ?, updatedAt = ? WHERE id = ?;`,
        [qtyToPurchase, now, inventoryItemId]
      );

      // 2. Add inventory history entry (inline to stay in same transaction)
      const updatedInventoryItem = await db.getFirstAsync<{ quantity: number }>(
        `SELECT quantity FROM inventory_items WHERE id = ?;`,
        [inventoryItemId]
      );
      if (updatedInventoryItem) {
        const notes = `Comprou ${qtyToPurchase} unidades (via Lista de Compras)`;
        const existingEntry = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM inventory_history WHERE inventoryItemId = ? AND date = ?;`,
          [inventoryItemId, dateToSave]
        );
        if (existingEntry) {
          await db.runAsync(
            `UPDATE inventory_history SET quantity = ?, notes = ?, createdAt = ? WHERE id = ?;`,
            [updatedInventoryItem.quantity, notes, now, existingEntry.id]
          );
        } else {
          await db.runAsync(
            `INSERT INTO inventory_history (inventoryItemId, quantity, date, notes, createdAt) VALUES (?, ?, ?, ?, ?);`,
            [inventoryItemId, updatedInventoryItem.quantity, dateToSave, notes, now]
          );
        }
      }

      // 3. Delete the shopping list item
      await db.runAsync(`DELETE FROM shopping_list_items WHERE id = ?;`, [shoppingListItemId]);
    }
  });
};

// --- SETTINGS CRUD OPERATIONS ---

export const getSetting = async (key: string): Promise<string | null> => {
  const db = getDb();
  try {
    const result = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [key]
    );
    return result?.value ?? null;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    throw error;
  }
};

export const setSetting = async (key: string, value: string | null): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.runAsync(
      `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?`,
      [key, value, now, value, now]
    );
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    throw error;
  }
};

export const getAllSettings = async (): Promise<{ key: string; value: string | null }[]> => {
  const db = getDb();
  try {
    const result = await db.getAllAsync<{ key: string; value: string }>(
      "SELECT key, value FROM settings ORDER BY key ASC"
    );
    return result.map(r => ({ key: r.key, value: r.value ?? null }));
  } catch (error) {
    console.error("Error getting all settings:", error);
    throw error;
  }
};

// --- ASSOCIATION CHECK FUNCTIONS ---

export const getProductAssociations = async (productId: number): Promise<{
  inventoryCount: number;
  purchaseCount: number;
}> => {
  const db = getDb();
  try {
    const [inventoryResult, purchaseResult] = await Promise.all([
      db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM inventory_items WHERE productId = ?`,
        [productId]
      ),
      db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM invoice_items WHERE productId = ?`,
        [productId]
      )
    ]);
    return {
      inventoryCount: inventoryResult?.count ?? 0,
      purchaseCount: purchaseResult?.count ?? 0
    };
  } catch (error) {
    console.error("Error getting product associations:", error);
    throw error;
  }
};

export const getStoreAssociations = async (storeId: number): Promise<{
  invoiceCount: number;
}> => {
  const db = getDb();
  try {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM invoices WHERE storeId = ?`,
      [storeId]
    );
    return { invoiceCount: result?.count ?? 0 };
  } catch (error) {
    console.error("Error getting store associations:", error);
    throw error;
  }
};

export const getCategoryAssociations = async (categoryId: number): Promise<{
  productCount: number;
}> => {
  const db = getDb();
  try {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM products WHERE categoryId = ?`,
      [categoryId]
    );
    return { productCount: result?.count ?? 0 };
  } catch (error) {
    console.error("Error getting category associations:", error);
    throw error;
  }
};

// --- GLOBAL INVOICE FUNCTIONS ---

export const getAllInvoices = async (): Promise<{
  id: number;
  storeName: string;
  listName: string;
  total: number;
  createdAt: string;
}[]> => {
  const db = getDb();
  try {
    return await db.getAllAsync(
      `SELECT 
        i.id,
        s.name as storeName,
        l.name as listName,
        i.total,
        i.createdAt
      FROM invoices i
      JOIN stores s ON i.storeId = s.id
      JOIN lists l ON i.listId = l.id
      ORDER BY i.createdAt DESC`
    );
  } catch (error) {
    console.error("Error getting all invoices:", error);
    throw error;
  }
};

export const getInvoiceDetails = async (invoiceId: number): Promise<{
  invoice: {
    id: number;
    storeName: string;
    listName: string;
    total: number;
    createdAt: string;
  };
  items: {
    id: number;
    productName: string;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number;
  }[];
}> => {
  const db = getDb();
  try {
    const invoice = await db.getFirstAsync<{
      id: number;
      storeName: string;
      listName: string;
      total: number;
      createdAt: string;
    }>(
      `SELECT 
        i.id,
        s.name as storeName,
        l.name as listName,
        i.total,
        i.createdAt
      FROM invoices i
      JOIN stores s ON i.storeId = s.id
      JOIN lists l ON i.listId = l.id
      WHERE i.id = ?`,
      [invoiceId]
    );

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const items = await db.getAllAsync<{
      id: number;
      productName: string;
      quantity: number;
      unitPrice: number | null;
      lineTotal: number;
    }>(
      `SELECT 
        ii.id,
        p.name as productName,
        ii.quantity,
        ii.unitPrice,
        ii.lineTotal
      FROM invoice_items ii
      JOIN products p ON ii.productId = p.id
      WHERE ii.invoiceId = ?
      ORDER BY ii.id ASC`,
      [invoiceId]
    );

    return { invoice, items };
  } catch (error) {
    console.error("Error getting invoice details:", error);
    throw error;
  }
};

export const deleteInvoice = async (invoiceId: number): Promise<void> => {
  const db = getDb();
  try {
    await db.runAsync(`DELETE FROM invoices WHERE id = ?`, [invoiceId]);
  } catch (error) {
    console.error("Error deleting invoice:", error);
    throw error;
  }
};

// --- UPDATE FUNCTIONS FOR PRODUCTS/STORES/CATEGORIES ---

export const updateProductCategory = async (productId: number, categoryId: number | null): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.runAsync(
      `UPDATE products SET categoryId = ?, updatedAt = ? WHERE id = ?`,
      [categoryId, now, productId]
    );
  } catch (error) {
    console.error("Error updating product category:", error);
    throw error;
  }
};

export const updateCategoryName = async (id: number, name: string): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Category name is required");
  }
  try {
    const duplicateCategory = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM categories WHERE name = ? AND id != ?`,
      [normalized, id]
    );
    if (duplicateCategory) {
      throw new Error("Category name already exists");
    }
    await db.runAsync(
      `UPDATE categories SET name = ?, updatedAt = ? WHERE id = ?`,
      [normalized, now, id]
    );
  } catch (error) {
    console.error("Error updating category name:", error);
    throw error;
  }
};

export const deleteCategory = async (id: number): Promise<void> => {
  const db = getDb();
  try {
    await db.runAsync("DELETE FROM categories WHERE id = ?", [id]);
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
};

export const updateStoreName = async (id: number, name: string): Promise<void> => {
  const db = getDb();
  const normalized = normalizeStoreName(name);
  if (!normalized) {
    throw new Error("Store name is required");
  }
  try {
    const duplicateStore = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM stores WHERE name = ? AND id != ?`,
      [normalized, id]
    );
    if (duplicateStore) {
      throw new Error("Store name already exists");
    }
    await db.runAsync(
      `UPDATE stores SET name = ? WHERE id = ?`,
      [normalized, id]
    );
  } catch (error) {
    console.error("Error updating store name:", error);
    throw error;
  }
};

export const deleteStore = async (id: number): Promise<void> => {
  const db = getDb();
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM stores WHERE id = ?", [id]);
      await db.runAsync(
        "DELETE FROM settings WHERE key = ? AND value = ?",
        ["defaultStoreId", id.toString()]
      );
    });
  } catch (error) {
    console.error("Error deleting store:", error);
    throw error;
  }
};

// --- CONSUMPTION AND SHOPPING LIST FUNCTIONS ---

export const getProductConsumptionStats = async (
  inventoryItemId: number,
  productId: number,
): Promise<{
  avgWeeklyConsumption: number | null;
  avgPrice90d: number | null;
  lowestPrice90d: { price: number; storeName: string } | null;
}> => {
  const db = getDb();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

  // Get history entries ordered by date ASC, last 90 days
  const history = await db.getAllAsync<{ date: string; quantity: number }>(
    `SELECT date, quantity FROM inventory_history 
     WHERE inventoryItemId = ? AND date >= ?
     ORDER BY date ASC;`,
    [inventoryItemId, ninetyDaysAgoStr]
  );

  let avgWeeklyConsumption: number | null = null;

  if (history.length >= 2) {
    // Sum all drops between consecutive snapshots
    let totalConsumed = 0;
    for (let i = 1; i < history.length; i++) {
      const drop = history[i - 1].quantity - history[i].quantity;
      if (drop > 0) totalConsumed += drop;
    }
    // Days in interval
    const firstDateStr = history[0].date.includes('T') ? history[0].date : history[0].date + 'T00:00:00';
    const lastDateStr = history[history.length - 1].date.includes('T') ? history[history.length - 1].date : history[history.length - 1].date + 'T00:00:00';
    const firstDate = new Date(firstDateStr);
    const lastDate = new Date(lastDateStr);
    const days = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    avgWeeklyConsumption = (totalConsumed / days) * 7;
  } else if (history.length === 1) {
    // Only one point — can't calculate consumption
    avgWeeklyConsumption = null;
  }

  // Price stats from invoice_items last 90 days
  const priceRows = await db.getAllAsync<{ unitPrice: number; storeName: string }>(
    `SELECT ii.unitPrice, s.name as storeName
     FROM invoice_items ii
     JOIN invoices inv ON ii.invoiceId = inv.id
     LEFT JOIN stores s ON inv.storeId = s.id
     WHERE ii.productId = ? 
       AND ii.unitPrice IS NOT NULL 
       AND ii.unitPrice > 0
       AND inv.createdAt >= ?
     ORDER BY ii.unitPrice ASC;`,
    [productId, ninetyDaysAgo.toISOString()]
  );

  const avgPrice90d = priceRows.length > 0
    ? priceRows.reduce((sum, r) => sum + r.unitPrice, 0) / priceRows.length
    : null;

  const lowestPrice90d = priceRows.length > 0
    ? { price: priceRows[0].unitPrice, storeName: priceRows[0].storeName }
    : null;

  return { avgWeeklyConsumption, avgPrice90d, lowestPrice90d };
};

export const getShoppingListItemForInventoryItem = async (
  inventoryItemId: number
): Promise<{ id: number; quantity: number; price?: number } | null> => {
  const db = getDb();
  const result = await db.getFirstAsync<{ id: number; quantity: number; price: number | null }>(
    `SELECT id, quantity, price FROM shopping_list_items WHERE inventoryItemId = ?;`,
    [inventoryItemId]
  );
  return result ?? null;
};

export const getPriceHistory = async (productId: number): Promise<{ date: string; price: number; storeName: string }[]> => {
  const db = getDb();
  return db.getAllAsync(`
    SELECT inv_i.createdAt as date, inv_i.unitPrice as price, s.name as storeName
    FROM invoice_items inv_i
    JOIN invoices inv ON inv_i.invoiceId = inv.id
    LEFT JOIN stores s ON inv.storeId = s.id
    WHERE inv_i.productId = ? AND inv_i.unitPrice IS NOT NULL
    ORDER BY inv_i.createdAt DESC LIMIT 20
  `, [productId]);
};

export const getLowestPriceForProducts = async (
  productIds: number[]
): Promise<Map<number, { price: number; storeName: string }>> => {
  if (productIds.length === 0) return new Map();
  const db = getDb();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const placeholders = productIds.map(() => '?').join(',');

  const rows = await db.getAllAsync<{ productId: number; unitPrice: number; storeName: string }>(
    `SELECT ii.productId, ii.unitPrice, s.name as storeName
     FROM invoice_items ii
     JOIN invoices inv ON ii.invoiceId = inv.id
     LEFT JOIN stores s ON inv.storeId = s.id
     WHERE ii.productId IN (${placeholders})
       AND ii.unitPrice IS NOT NULL
       AND ii.unitPrice > 0
       AND inv.createdAt >= ?
     ORDER BY ii.productId, ii.unitPrice ASC;`,
    [...productIds, ninetyDaysAgo]
  );

  const result = new Map<number, { price: number; storeName: string }>();
  for (const row of rows) {
    if (!result.has(row.productId)) {
      result.set(row.productId, { price: row.unitPrice, storeName: row.storeName });
    }
  }
  return result;
};

// ─── Reference Price — single upserts ────────────────────────────────────────

export const upsertProductStorePrice = async (
  productId: number,
  storeId: number,
  price: number
): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.runAsync(
      `INSERT INTO product_store_prices (productId, storeId, price, updatedAt)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (productId, storeId) DO UPDATE SET
         price     = excluded.price,
         updatedAt = excluded.updatedAt;`,
      [productId, storeId, price, now]
    );
  } catch (error) {
    console.error('Error upserting product store price:', error);
    throw error;
  }
};

export const upsertProductBasePrice = async (
  productId: number,
  price: number
): Promise<void> => {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    await db.runAsync(
      `INSERT INTO product_base_prices (productId, price, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT (productId) DO UPDATE SET
         price     = excluded.price,
         updatedAt = excluded.updatedAt;`,
      [productId, price, now]
    );
  } catch (error) {
    console.error('Error upserting product base price:', error);
    throw error;
  }
};

// ─── Reference Price — single lookup (full chain) ────────────────────────────

/**
 * Returns the best reference price for a product, walking the full chain:
 * 1. product_store_prices @ storeId
 * 2. product_base_prices
 * 4. last invoice price @ any store
 *
 * storeId is optional — if null, skips steps 1 and 2.
 */
export const getReferencePriceForProduct = async (
  productId: number,
  storeId: number | null
): Promise<number | null> => {
  const db = getDb();
  try {
    if (storeId !== null) {
      // 1. Store reference price
      const storeRef = await db.getFirstAsync<{ price: number }>(
        `SELECT price FROM product_store_prices WHERE productId = ? AND storeId = ?;`,
        [productId, storeId]
      );
      if (storeRef?.price != null) return storeRef.price;

      // 2. Last invoice at this store
      const storeInvoice = await db.getFirstAsync<{ unitPrice: number }>(
        `SELECT ii.unitPrice
         FROM invoice_items ii
         INNER JOIN invoices i ON ii.invoiceId = i.id
         WHERE ii.productId = ? AND i.storeId = ?
         ORDER BY i.createdAt DESC
         LIMIT 1;`,
        [productId, storeId]
      );
      return storeInvoice?.unitPrice ?? null;
    }

    // storeId === null
    // 1. Base reference price
    const baseRef = await db.getFirstAsync<{ price: number }>(
      `SELECT price FROM product_base_prices WHERE productId = ?;`,
      [productId]
    );
    if (baseRef?.price != null) return baseRef.price;

    // 2. Last invoice any store
    const anyInvoice = await db.getFirstAsync<{ unitPrice: number }>(
      `SELECT unitPrice
       FROM invoice_items
       WHERE productId = ? AND unitPrice IS NOT NULL
       ORDER BY createdAt DESC
       LIMIT 1;`,
      [productId]
    );
    return anyInvoice?.unitPrice ?? null;

  } catch (error) {
    console.error('Error getting reference price for product:', error);
    return null;
  }
};

// ─── Reference Price — batch lookup (for ShoppingListScreen) ─────────────────

/**
 * Returns a Map<productId, price> with the best reference price for each product.
 * Walks the same 4-step chain but in batch — O(1) per item after the queries.
 *
 * storeId is optional — if null, skips store-specific steps.
 */
export const getReferencePricesForProducts = async (
  productIds: number[],
  storeId: number | null
): Promise<Map<number, number>> => {
  if (productIds.length === 0) return new Map();

  const db = getDb();
  const result = new Map<number, number>();
  const remaining = new Set(productIds);
  const placeholders = productIds.map(() => '?').join(',');

  try {
    if (storeId !== null) {
      // 1. Store reference prices
      const rows = await db.getAllAsync<{ productId: number; price: number }>(
        `SELECT productId, price
         FROM product_store_prices
         WHERE productId IN (${placeholders}) AND storeId = ?;`,
        [...productIds, storeId]
      );
      for (const row of rows) {
        result.set(row.productId, row.price);
        remaining.delete(row.productId);
      }

      if (remaining.size === 0) return result;

      // 2. Last invoice at this store
      const remainingIds = [...remaining];
      const remainingPlaceholders = remainingIds.map(() => '?').join(',');
      const invoiceStoreRows = await db.getAllAsync<{ productId: number; unitPrice: number }>(
        `SELECT ii.productId, ii.unitPrice
         FROM invoice_items ii
         INNER JOIN invoices i ON ii.invoiceId = i.id
         WHERE ii.productId IN (${remainingPlaceholders}) AND i.storeId = ? AND ii.unitPrice IS NOT NULL
         ORDER BY ii.productId, i.createdAt DESC;`,
        [...remainingIds, storeId]
      );
      const seenStore = new Set<number>();
      for (const row of invoiceStoreRows) {
        if (!seenStore.has(row.productId)) {
          result.set(row.productId, row.unitPrice);
          remaining.delete(row.productId);
          seenStore.add(row.productId);
        }
      }

      return result;
    }

    // storeId === null
    // 1. Base reference prices
    const baseRows = await db.getAllAsync<{ productId: number; price: number }>(
      `SELECT productId, price
       FROM product_base_prices
       WHERE productId IN (${placeholders});`,
      productIds
    );
    for (const row of baseRows) {
      result.set(row.productId, row.price);
      remaining.delete(row.productId);
    }

    if (remaining.size === 0) return result;

    // 2. Last invoice any store
    const remainingIds = [...remaining];
    const remainingPlaceholders = remainingIds.map(() => '?').join(',');
    const invoiceAnyRows = await db.getAllAsync<{ productId: number; unitPrice: number }>(
      `SELECT productId, unitPrice
       FROM invoice_items
       WHERE productId IN (${remainingPlaceholders}) AND unitPrice IS NOT NULL
       ORDER BY productId, createdAt DESC;`,
      remainingIds
    );
    const seenAny = new Set<number>();
    for (const row of invoiceAnyRows) {
      if (!seenAny.has(row.productId)) {
        result.set(row.productId, row.unitPrice);
        remaining.delete(row.productId);
        seenAny.add(row.productId);
      }
    }

    return result;

  } catch (error) {
    console.error('Error getting reference prices for products:', error);
    throw error;
  }
};