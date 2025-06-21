import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export const initializeDatabase = async (
  databaseName: string = "listai.db"
): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(databaseName);
    // Create initial tables if they don't exist using runAsync
    try {
      await Promise.all([
        db.runAsync(`
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            quantity INTEGER NOT NULL,
            \`order\` INTEGER NOT NULL DEFAULT 0,
            listId INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY(listId) REFERENCES lists(id) ON DELETE CASCADE
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
    } catch (error) {
      console.error("Error creating initial tables:", error);
      throw error; // Re-throw the error to indicate initialization failure
    }
  }
  return db;
};

const getDb = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error(
      "Database has not been initialized. Call initializeDatabase() first."
    );
  }
  return db;
};

export interface Product {
  id: number;
  name: string;
  quantity: number;
  order: number;
  listId: number;
}

export interface QuantityHistory {
  id: number;
  productId: number;
  quantity: number;
  date: string;
}

export interface List {
  id: number;
  name: string;
  order: number;
}

const expectedSchemas = {
  products: [
    { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    { name: "name", type: "TEXT NOT NULL UNIQUE" },
    { name: "quantity", type: "INTEGER NOT NULL" },
    { name: "order", type: "INTEGER NOT NULL", default: 0 },
    { name: "listId", type: "INTEGER NOT NULL", default: 1 },
  ],
  quantity_history: [
    { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    { name: "productId", type: "INTEGER NOT NULL" },
    { name: "quantity", type: "INTEGER NOT NULL" },
    { name: "date", type: "TEXT NOT NULL" },
    { name: "UNIQUE", type: "(productId, date)" },
  ],
  lists: [
    { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT", default: 1 },
    { name: "name", type: "TEXT NOT NULL UNIQUE" },
    { name: "order", type: "INTEGER NOT NULL", default: 0 },
  ],
};

const getExistingColumns = (tableName: string): string[] => {
  try {
    const result = getDb().getAllSync(`PRAGMA table_info(${tableName});`) as {
      name: string;
    }[];
    return result.map((columnInfo) => columnInfo.name);
  } catch (error) {
    console.error(`Error getting column info for ${tableName}:`, error);
    return [];
  }
};

const addMissingColumn = (
  tableName: string,
  columnName: string,
  columnType: string,
  defaultValue: any
) => {
  const defaultValueClause =
    typeof defaultValue !== "undefined" ? `DEFAULT ${defaultValue}` : "";
  const alterStatement = `ALTER TABLE ${tableName} ADD COLUMN \`${columnName}\` ${columnType.replace(
    "NOT NULL",
    ""
  )}${defaultValueClause};`;
  getDb().execSync(alterStatement);
};

const repairDatabaseSchema = (tableName: string) => {
  console.log("Repairing database schema for table:", tableName);
  const columns = expectedSchemas[tableName];

  // Check if the table exists
  let tableExists = false;
  try {
    getDb().execSync(`SELECT 1 FROM ${tableName} LIMIT 1;`);
    tableExists = true;
  } catch (e: any) {
    if (e.message.includes("no such table")) {
      tableExists = false;
    } else {
      throw e; // Re-throw any other errors
    }
  }

  if (!tableExists) {
    const createStatement = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns
      .map((col) => `${col.name} ${col.type}`)
      .join(", ")});`;
    getDb().execSync(createStatement);
  } else {
    const existingColumns = getExistingColumns(tableName);
    columns.forEach((expectedColumn) => {
      if (!existingColumns.includes(expectedColumn.name)) {
        addMissingColumn(
          tableName,
          expectedColumn.name,
          expectedColumn.type,
          expectedColumn.default
        );
      }
    });
  }
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
  quantity: number,
  listId?: number
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

export const getLists = (): Promise<List[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      console.log("gettin lists fr");
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
          repairDatabaseSchema("products");
          const result = getDb().getAllSync(
            "SELECT * FROM products ORDER BY `order` ASC;"
          );
          resolve(result as Product[]); // Retry after repair
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
): Promise<QuantityHistory[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      const query = `SELECT * FROM quantity_history WHERE productId = ? ORDER BY date DESC;`;
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
      const result: QuantityHistory[] = genericRows.map((row) => ({
        id: row.id,
        productId: row.productId,
        quantity: row.quantity,
        date: row.date,
        // Ensure all properties of QuantityHistory are here
      }));
      resolve(result);
    } catch (error: any) {
      console.error("Error fetching product history:", error);
      reject(error);
    }
  });
};

export const updateProduct = (id: number, quantity: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      getDb().execSync(
        `UPDATE products SET quantity = ${quantity} WHERE id = ${id};`
      );
      resolve();
    } catch (error) {
      reject(error);
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
          `SELECT id FROM quantity_history WHERE productId = ${product.id} AND date >= '${todayStart}' AND date < '${todayEnd}';`
        ) as { id: number };

        if (existingEntry) {
          database.execSync(
            `UPDATE quantity_history SET quantity = ${product.quantity}, date = '${dateToSave}' WHERE id = ${existingEntry.id};`
          );
        } else {
          database.execSync(
            `INSERT INTO quantity_history (productId, quantity, date) VALUES (${product.id}, ${product.quantity}, '${dateToSave}');`
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

export const updateProductOrder = (
  updates: { id: number; order: number }[]
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let database: SQLite.SQLiteDatabase; // No initial null

    try {
      database = getDb();
      database.runAsync("BEGIN TRANSACTION;");

      updates.forEach(({ id, order }) => {
        database.runAsync(
          "UPDATE products SET `order` = ? WHERE id = ?",
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

export const updateProductQuantity = async (
  productId: number,
  newQuantity: number
): Promise<void> => {
  try {
    const database = getDb();
    await database.runAsync("UPDATE products SET quantity = ? WHERE id = ?", [
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
