import * as SQLite from "expo-sqlite";
import { Product, InventoryItem, InventoryHistory, List, ShoppingListItem } from "./models/models";
import { CURRENT_DATABASE_VERSION, runMigrations } from "./migrations"; // Import migration logic

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


export const addList = async (
  name: string,
  order: number = 0
): Promise<number> => {
  const db = getDb();
  try {
    // Checa se já existe uma lista com o mesmo nome
    const existingList = db.getFirstSync<{ id: number }>(
      "SELECT id FROM lists WHERE name = ?",
      [name.trim()]
    );

    if (existingList) {
      return existingList.id;
    }

    // Insere nova lista
    await db.runAsync("INSERT INTO lists (name, `order`) VALUES (?, ?);", [
      name.trim(),
      order,
    ]);

    // Retorna o ID da lista inserida
    const lastInserted = db.getFirstSync<{ id: number }>(
      "SELECT last_insert_rowid() as id;"
    );

    if (lastInserted?.id) {
      return lastInserted.id;
    } else {
      throw new Error("Falha ao obter ID da lista inserida.");
    }
  } catch (error: any) {
    console.error("Erro ao adicionar lista:", error);
    throw new Error(error.message || "Erro desconhecido.");
  }
};

export const addProduct = async (
  name: string,
): Promise<number> => {
  const db = getDb();
  try {
    // Check if the product already exists using a parameterized query
    const existingProduct = db.getFirstSync<{ id: number }>(
      "SELECT id FROM products WHERE name = ?",
      [name] // Pass the name as a parameter
    );

    if (existingProduct) {
      return existingProduct.id;
    }
    // Insert the new product using a parameterized query
    await db.runAsync(
      "INSERT INTO products (name, quantity, listId) VALUES (?, ?, ?)",
      [name.trim(), quantity, listId ?? 1] // Pass name and quantity as parameters
    );

    // Get the last inserted ID
    const lastInsertedRow = db.getFirstSync<{ id: number }>(
      "SELECT last_insert_rowid() as id;"
    );

    if (lastInsertedRow && lastInsertedRow.id) {
      return lastInsertedRow.id;
    } else {
      throw new Error("Failed to get inserted ID");
    }
  } catch (error) {
    console.log("error", error);
    console.error("Error adding product:", error);
    throw new Error(error.message);
  }
};


export const addInventoryItem = async (
  name: string,
  quantity: number,
  listId?: number
): Promise<number> => {
  const db = getDb();
  try {
    // Check if the product already exists using a parameterized query
    const existingProduct = db.getFirstSync<{ id: number }>(
      "SELECT id FROM inventory_items WHERE name = ?",
      [name] // Pass the name as a parameter
    );

    if (existingProduct) {
      return existingProduct.id;
    }
    // Insert the new product using a parameterized query
    await db.runAsync(
      "INSERT INTO inventory_items (name, quantity, listId) VALUES (?, ?, ?)",
      [name.trim(), quantity, listId ?? 1] // Pass name and quantity as parameters
    );

    // Get the last inserted ID
    const lastInsertedRow = db.getFirstSync<{ id: number }>(
      "SELECT last_insert_rowid() as id;"
    );

    if (lastInsertedRow && lastInsertedRow.id) {
      return lastInsertedRow.id;
    } else {
      throw new Error("Failed to get inserted ID");
    }
  } catch (error) {
    console.log("error", error);
    console.error("Error adding product:", error);
    throw new Error(error.message);
  }
};

export const getLists = (): Promise<List[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      const result = database.getAllSync(
        "SELECT * FROM lists ORDER BY `order` ASC;"
      );
      resolve(result as List[]);
    } catch (error) {
      reject(error);
    }
  });
};

export const getProducts = (listId: number): Promise<Product[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      const result = database.getAllSync(
        "SELECT * FROM products WHERE listId = ? ORDER BY `order` ASC;",
        [listId]
      );
      resolve(result as Product[]);
    } catch (error: any) {
      if (
        error.message.includes("no such column") ||
        error.message.includes("no such table")
      ) {
        try {
          console.log("Repairing database schema for products table", error);
          const result = getDb().getAllSync(
            "SELECT * FROM products ORDER BY `order` ASC;"
          );
          resolve(result as Product[]);
        } catch (repairError) {
          reject(repairError);
        }
      } else {
        reject(error);
      }
    }
  });
};

export const getProductHistory = (
  identifier: string
): Promise<InventoryHistory[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      const query = `SELECT * FROM inventory_history WHERE productId = ? ORDER BY date DESC;`;
      let params: any[] = [];

      if (!isNaN(parseInt(identifier, 10))) {
        params = [parseInt(identifier, 10)];
      } else {
        const product = database.getFirstSync<{ id: number }>(
          `SELECT id FROM products WHERE name = ?;`,
          [identifier]
        );
        if (!product) {
          resolve([]);
          return;
        }
        params = [product.id];
      }
      const genericRows: any[] = database.getAllSync(query, params);
      const result: InventoryHistory[] = genericRows.map((row) => ({
        id: row.id,
        productId: row.productId,
        quantity: row.quantity,
        date: row.date,
        listId: row.listId,
        createdAt: row.createdAt,
        notes: row.notes,
      }));
      resolve(result);
    } catch (error: any) {
      console.error("Error fetching product history:", error);
      reject(error);
    }
  });
};

export const getInventoryItems = (listId: number): Promise<InventoryItem[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      const result = database.getAllSync(
        "SELECT * FROM inventory_items WHERE listId = ? ORDER BY sortOrder ASC;",
        [listId]
      );
      resolve(result as InventoryItem[]);
    } catch (error: any) {
      if (
        error.message.includes("no such column") ||
        error.message.includes("no such table")
      ) {
        try {
          console.log("Repairing database schema for inventory_items table", error);
          const result = getDb().getAllSync(
            "SELECT * FROM inventory_items ORDER BY sortOrder ASC;"
          );
          resolve(result as InventoryItem[]);
        } catch (repairError) {
          reject(repairError);
        }
      } else {
        reject(error);
      }
    }
  });
};

export const saveProductHistory = async (
  overrideDate?: Date
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();
      const now = overrideDate ? overrideDate : new Date();
      const dateToSave = now.toISOString();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).toISOString();
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      ).toISOString();

      const latestProducts = database.getAllSync(
        "SELECT id, quantity FROM products;"
      ) as { id: number; quantity: number }[];

      latestProducts.forEach((product) => {
        const existingEntry = database.getFirstSync(
          `SELECT id FROM inventory_history WHERE productId = ${product.id} AND date >= '${todayStart}' AND date < '${todayEnd}';`
        ) as { id: number };

        if (existingEntry) {
          database.execSync(
            `UPDATE inventory_history SET quantity = ${product.quantity}, date = '${dateToSave}' WHERE id = ${existingEntry.id};`
          );
        } else {
          database.execSync(
            `INSERT INTO inventory_history (productId, quantity, date) VALUES (${product.id}, ${product.quantity}, '${dateToSave}');`
          );
        }
      });

      resolve();
    } catch (error) {
      console.error("Error in saveProductHistory:", error);
      reject(error);
    }
  });
};

export const deleteProduct = async (id: number): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      await getDb().runAsync("DELETE FROM products WHERE id = ?", id);
      resolve();
    } catch (error) {
      console.log("error:", error);
      reject(error);
    }
  });
};

export const deleteInventoryItem = async (id: number): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      await getDb().runAsync("DELETE FROM inventory_items WHERE id = ?", id);
      resolve();
    } catch (error) {
      console.log("error:", error);
      reject(error);
    }
  });
};

export const updateInventoryItemOrder = (
  updates: { id: number; order: number }[]
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let database: SQLite.SQLiteDatabase; // No initial null

    try {
      database = getDb();
      database.runAsync("BEGIN TRANSACTION;");

      updates.forEach(({ id, order }) => {
        database.runAsync(
          "UPDATE inventory_items SET `order` = ? WHERE id = ?",
          order,
          id
        );
      });

      database.runAsync("COMMIT;");
      resolve();
    } catch (error) {
      // database should be defined here if getDb() succeeded
      if (database) {
        try {
          database.runAsync("ROLLBACK;");
        } catch (rollbackError) {
          console.error("Error during rollback:", rollbackError);
        }
      }
      reject(error);
    }
  });
};

export const updateProductName = (id: number, name: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      await database.runAsync(
        `UPDATE products SET name = ? WHERE id = ?;`,
        [name.trim(), id] // Pass name and id as parameters
      );
      resolve();
    } catch (error) {
      console.error("Error updating product name:", error);
      reject(error);
    }
  });
};

export const saveProductHistoryForSingleProduct = async (
  productId: number,
  quantity: number,
  date: Date
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();
      const dateToSave = date.toISOString();
      database.runAsync(
        `INSERT INTO quantity_history (productId, quantity, date) VALUES (?, ?, ?);`,
        [productId, quantity, dateToSave]
      );
      resolve();
    } catch (error) {
      console.error("Error saving history for product ID:", productId, error);
      reject(error);
    }
  });
};

export const updateInventoryItemQuantity = async (
  productId: number,
  newQuantity: number
): Promise<void> => {
  try {
    const database = getDb();
    await database.runAsync("UPDATE inventory_items SET quantity = ? WHERE id = ?", [
      newQuantity,
      productId,
    ]);
  } catch (error) {
    console.error("Error updating product quantity:", error);
    throw error;
  }
};

export const consolidateProductHistory = async (
  sourceProductId: number,
  targetProductId: number
): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  try {
    const database = getDb();
    await database.execSync(`
      BEGIN TRANSACTION;

      -- Delete any duplicate history entries for today in the target product
      DELETE FROM quantity_history
      WHERE productId = ${targetProductId}
      AND date = '${today}';

      -- Get the latest history entry from source product for today
      INSERT INTO quantity_history (productId, quantity, date)
      SELECT ${targetProductId}, quantity, date
      FROM quantity_history
      WHERE productId = ${sourceProductId}
      AND date = '${today}';

      -- Delete the source product's history
      DELETE FROM quantity_history
      WHERE productId = ${sourceProductId};

      -- Delete the source product
      DELETE FROM products
      WHERE id = ${sourceProductId};

      COMMIT;
    `);
  } catch (error) {
    console.error("Error consolidating product history:", error);
    await getDb().execSync("ROLLBACK;");
    throw error;
  }
};

export const getListById = (id: number): Promise<List | undefined> => {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();
      const result = database.getFirstSync(
        "SELECT * FROM lists WHERE id = ?;",
        [id]
      );
      resolve(result as List | undefined);
    } catch (error) {
      reject(error);
    }
  });
};

export const updateListName = (id: number, name: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      await database.runAsync(
        `UPDATE lists SET name = ? WHERE id = ?;`,
        [name.trim(), id]
      );
      resolve();
    } catch (error) {
      console.error("Error updating list name:", error);
      reject(error);
    }
  });
};

export const deleteList = (id: number): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      await database.runAsync(`DELETE FROM lists WHERE id = ?;`, [id]);
      resolve();
    } catch (error) {
      console.error("Error deleting list:", error);
      reject(error);
    }
  });
};

export const updateProductList = (productId: number, newListId: number): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      await database.runAsync(
        `UPDATE products SET listId = ? WHERE id = ?;`,
        [newListId, productId]
      );
      resolve();
    } catch (error) {
      console.error("Error updating product listId:", error);
      reject(error);
    }
  });
};
