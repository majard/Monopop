import * as SQLite from "expo-sqlite";
import {
  Product,
  QuantityHistory,
  addProduct,
  getProducts,
  updateProductQuantity,
  deleteProduct,
  updateProductOrder,
  saveProductHistory,
  getProductHistory,
  updateProductName,
  saveProductHistoryForSingleProduct,
  consolidateProductHistory,
  initializeDatabase,
} from "../../database/database";

// Mock the expo-sqlite module
jest.mock("expo-sqlite", () => ({
  openDatabaseSync: jest.fn(),
  openDatabaseAsync: jest.fn(),
  getDb: jest.fn(),
}));

// Create mock database object type
type MockDatabase = {
  exec: jest.Mock;
  execSync: jest.Mock;
  getAllSync: jest.Mock;
  getFirstSync: jest.Mock;
  runAsync: jest.Mock;
  getDb: jest.Mock;
};

// Create mock database object
const mockDb: MockDatabase = {
  exec: jest.fn(),
  execSync: jest.fn(),
  getAllSync: jest.fn(),
  getFirstSync: jest.fn(),
  runAsync: jest.fn(),
  getDb: jest.fn(),
};

describe("Database Functions", () => {
  beforeEach(() => {
    // Clear all mock implementations and call history
    jest.clearAllMocks();

    (SQLite.openDatabaseAsync as jest.Mock).mockReturnValue(mockDb);

    initializeDatabase();

    // Reset the return values of the mockDb functions
    mockDb.getFirstSync.mockReset();
    mockDb.runAsync.mockReset();
    mockDb.execSync.mockReset();
    mockDb.getAllSync.mockReset();
    mockDb.exec.mockReset();
    mockDb.getDb.mockReset(); // Reset getDb as well

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("addProduct", () => {
    test("adds a new product successfully", async () => {
      // Simulate that the product does NOT exist initially
      mockDb.getFirstSync.mockReturnValueOnce(null);

      mockDb.runAsync.mockReturnValueOnce({}); // Simulate successful INSERT
      mockDb.getFirstSync.mockReturnValueOnce({ id: 1 }); // Simulate getting the last inserted ID

      const result = await addProduct("Test Product", 5);

      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM products WHERE name = ?"),
        ["Test Product"]
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        "INSERT INTO products (name, quantity) VALUES (?, ?)",
        ["Test Product", 5]
      );

      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT last_insert_rowid() as id;")
      );

      expect(result).toBe(1);
    });

    test("returns existing product ID if product already exists", async () => {
      mockDb.getFirstSync.mockReturnValueOnce({ id: 2 }); // Simulate existing product
      const result = await addProduct("Existing Product", 7);

      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM products WHERE name = ?"),
        ["Existing Product"]
      );
      expect(result).toBe(2);
      expect(mockDb.runAsync).not.toHaveBeenCalled(); // Ensure no INSERT
      expect(mockDb.getFirstSync).toHaveBeenCalledTimes(1); // Ensure it was only called once
    });

    test("handles SQL errors during initial insert", async () => {
      const sqlError = new Error("SQL error during insert");
      mockDb.runAsync.mockImplementationOnce(() => {
        throw sqlError;
      });
      mockDb.getFirstSync.mockReturnValueOnce(null);
      await expect(addProduct("Test Product", 5)).rejects.toThrow("SQL error");
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM products WHERE name = ?"),
        ["Test Product"]
      );
      expect(mockDb.getFirstSync).not.toHaveBeenCalledWith(
        expect.stringContaining("SELECT last_insert_rowid() as id;")
      );
    });

    test("handles SQL errors when checking for existing product", async () => {
      const sqlError = new Error("SQL error during select");
      mockDb.getFirstSync.mockImplementationOnce(() => {
        throw sqlError;
      });
      await expect(addProduct("Existing Product", 5)).rejects.toThrow(
        "SQL error"
      );
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM products WHERE name = ?"),
        ["Existing Product"]
      );
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    test("handles failure to fetch last inserted ID (returns null)", async () => {
      mockDb.runAsync.mockReturnValueOnce({}); // Simulate successful insert
      mockDb.getFirstSync.mockReturnValueOnce(null); // Simulate successful query, but no ID

      await expect(addProduct("Another Product", 10)).rejects.toThrow(
        "Failed to get inserted ID"
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO products"),
        [`${"Another Product".trim()}`, 10]
      );
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT last_insert_rowid() as id;")
      );
    });
  });

  describe("getProducts", () => {
    const mockProducts = [
      { id: 1, name: "Test Product", quantity: 5, order: 0 },
    ];

    test("retrieves products successfully", async () => {
      mockDb.getAllSync.mockReturnValueOnce(mockProducts);
      const products = await getProducts();
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        "SELECT * FROM products ORDER BY `order` ASC;"
      );
      expect(products).toEqual(mockProducts);
    });

    test("handles SQL errors", async () => {
      const sqlError = new Error("SQL error");
      mockDb.getAllSync.mockImplementationOnce(() => {
        throw sqlError;
      });
      await expect(getProducts()).rejects.toThrow(sqlError);
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        "SELECT * FROM products ORDER BY `order` ASC;"
      );
    });

    test('retries and resolves after repairing schema if "no such column" error occurs', async () => {
      // Simulate the initial error when fetching products
      mockDb.getAllSync.mockImplementationOnce(() => {
        throw new Error("SQL logic error: no such column: order");
      });

      // Simulate the table existing check in repairDatabaseSchema
      mockDb.execSync.mockImplementationOnce(() => {}); // Successful SELECT 1

      // Simulate the PRAGMA call to get existing columns (missing 'order')
      mockDb.getAllSync.mockImplementationOnce(() => [
        { name: "id" },
        { name: "name" },
        { name: "quantity" },
      ]);

      // Capture the ALTER TABLE statements
      const alterStatements: string[] = [];
      mockDb.execSync.mockImplementation((sql: string) => {
        if (sql.startsWith("ALTER TABLE")) {
          alterStatements.push(sql);
        }
      });

      // Simulate the successful data fetch after repair
      mockDb.getAllSync.mockReturnValueOnce(mockProducts);

      const products = await getProducts();
      expect(products).toEqual(mockProducts);

      // Check that the ALTER TABLE statement for 'order' was called
      expect(alterStatements).toEqual([
        "ALTER TABLE products ADD COLUMN `order` INTEGER DEFAULT 0;",
      ]);

      expect(mockDb.getAllSync).toHaveBeenCalledTimes(3); // Initial fail, then pragma info, then success
      expect(mockDb.execSync).toHaveBeenCalledTimes(1 + alterStatements.length); // SELECT 1 + number of ALTER TABLE calls
    });

    test('retries and resolves after repairing schema if "no such table" error occurs', async () => {
      mockDb.getAllSync
        .mockImplementationOnce(() => {
          throw new Error("SQL logic error: no such table: products");
        })
        .mockReturnValueOnce(mockProducts)
        .mockReturnValueOnce(mockProducts);
      // Simulate table no such table error
      mockDb.execSync.mockImplementationOnce(() => {
        throw new Error("SQL logic error: no such table: products");
      });

      const products = await getProducts();
      expect(products).toEqual(mockProducts);
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS products")
      );
      expect(mockDb.getAllSync).toHaveBeenCalledTimes(2);
    });

    test("rejects if error occurs during schema repair", async () => {
      const schemaError = new Error("SQL error during create table");
      mockDb.getAllSync.mockImplementationOnce(() => {
        throw new Error("SQL logic error: no such table: products");
      });
      mockDb.execSync.mockImplementationOnce(() => {
        throw schemaError;
      });

      await expect(getProducts()).rejects.toThrow(schemaError);
      expect(mockDb.getAllSync).toHaveBeenCalledTimes(1);
      expect(mockDb.execSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateProductQuantity", () => {
    test("updates product quantity successfully", async () => {
      mockDb.runAsync.mockReturnValueOnce({ rowsAffected: 1 }); // Simulate update

      await updateProductQuantity(1, 10);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE products SET quantity = ? WHERE id = ?"
        ),
        [10, 1]
      );
    });

    test("handles SQL errors", async () => {
      const sqlError = new Error("SQL error during update");
      mockDb.runAsync.mockImplementationOnce(() => {
        throw sqlError;
      });

      await expect(updateProductQuantity(1, 10)).rejects.toThrow(sqlError);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE products SET quantity = ? WHERE id = ?"
        ),
        [10, 1]
      );
    });
  });

  describe("deleteProduct", () => {
    test("deletes a product successfully", async () => {
      mockDb.runAsync.mockReturnValueOnce({ rowsAffected: 1 });
      await deleteProduct(1);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        "DELETE FROM products WHERE id = ?",
        1
      );
    });

    test("handles SQL errors", async () => {
      const sqlError = new Error("SQL error");
      mockDb.runAsync.mockImplementationOnce(() => {
        throw sqlError;
      });
      await expect(deleteProduct(1)).rejects.toThrow(sqlError);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        "DELETE FROM products WHERE id = ?",
        1
      );
    });
  });

  describe("updateProductOrder", () => {
    const updates = [
      { id: 1, order: 2 },
      { id: 3, order: 1 },
    ];

    test("updates product order successfully", async () => {
      mockDb.runAsync.mockReturnValueOnce(undefined); // BEGIN
      mockDb.runAsync.mockReturnValueOnce({ rowsAffected: 1 }); // Update 1
      mockDb.runAsync.mockReturnValueOnce({ rowsAffected: 1 }); // Update 3
      mockDb.runAsync.mockReturnValueOnce(undefined); // COMMIT

      await updateProductOrder(updates);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("BEGIN TRANSACTION")
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET `order` = ? WHERE id = ?"),
        2,
        1
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET `order` = ? WHERE id = ?"),
        1,
        3
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("COMMIT")
      );
    });

    test("handles SQL errors", async () => {
      const sqlError = new Error("SQL error during update");
      mockDb.runAsync.mockImplementationOnce(() => {
        throw sqlError;
      });

      await expect(updateProductOrder(updates)).rejects.toThrow(sqlError);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("BEGIN TRANSACTION")
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("ROLLBACK")
      );
    });
  });

  describe("getProductHistory", () => {
    const mockHistory = [
      {
        id: 1,
        productId: 1,
        quantity: 5,
        date: new Date("2023-01-01T00:00:00.000Z").toISOString(),
      },
    ];

    test("retrieves product history by ID", async () => {
      mockDb.getAllSync.mockReturnValueOnce(mockHistory);
      const history = await getProductHistory("1");
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        "SELECT * FROM quantity_history WHERE productId = ? ORDER BY date DESC;",
        [1]
      );
      expect(history).toEqual(mockHistory);
    });

    test("retrieves product history by name", async () => {
      mockDb.getFirstSync.mockReturnValueOnce({ id: 1 });
      mockDb.getAllSync.mockReturnValueOnce(mockHistory);
      const result = await getProductHistory("Test Product");
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        "SELECT id FROM products WHERE name = ?;",
        ["Test Product"]
      );
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        "SELECT * FROM quantity_history WHERE productId = ? ORDER BY date DESC;",
        [1]
      );
      expect(result).toEqual(mockHistory);
    });

    test("returns empty array when product not found by name", async () => {
      mockDb.getFirstSync.mockReturnValueOnce(null);
      const result = await getProductHistory("Nonexistent Product");
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        "SELECT id FROM products WHERE name = ?;",
        ["Nonexistent Product"]
      );
      expect(mockDb.getAllSync).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test("handles SQL errors", async () => {
      const sqlError = new Error("SQL error");
      mockDb.getAllSync.mockImplementationOnce(() => {
        throw sqlError;
      });
      await expect(getProductHistory("1")).rejects.toThrow(sqlError);
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        "SELECT * FROM quantity_history WHERE productId = ? ORDER BY date DESC;",
        [1]
      );
    });
  });

  describe("updateProductName", () => {
    test("updates product name successfully", async () => {
      mockDb.runAsync.mockReturnValueOnce({ rowsAffected: 1 });
      await updateProductName(1, "New Product Name");
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET name = ? WHERE id = ?"),
        ["New Product Name", 1]
      );
    });

    test("handles SQL errors", async () => {
      const sqlError = new Error("SQL error");
      mockDb.runAsync.mockImplementationOnce(() => {
        throw sqlError;
      });
      await expect(updateProductName(1, "New Product Name")).rejects.toThrow(
        sqlError
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET name = ? WHERE id = ?"),
        ["New Product Name", 1]
      );
    });
  });

  describe("saveProductHistoryForSingleProduct", () => {
    const mockDate = new Date("2025-04-09T10:00:00.000Z");

    test("saves product history successfully for single product", async () => {
      mockDb.runAsync.mockReturnValueOnce({ rowsAffected: 1 });
      await saveProductHistoryForSingleProduct(1, 5, mockDate);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        "INSERT INTO quantity_history (productId, quantity, date) VALUES (?, ?, ?);",
        [1, 5, mockDate.toISOString()]
      );
    });

    test("handles SQL errors", async () => {
      const sqlError = new Error("SQL error");
      mockDb.runAsync.mockImplementationOnce(() => {
        throw sqlError;
      });
      await expect(
        saveProductHistoryForSingleProduct(1, 5, new Date())
      ).rejects.toThrow(sqlError);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        "INSERT INTO quantity_history (productId, quantity, date) VALUES (?, ?, ?);",
          [1, 5, expect.any(String)] // We can't predict the exact date
      );
    });
  });
});
