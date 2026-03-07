import * as SQLite from "expo-sqlite";

export const migrateToV8 = async (db: SQLite.SQLiteDatabase) => {
  console.log('Migrating to V8: Add performance indexes.');
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_invoices_createdAt ON invoices (createdAt);
    CREATE INDEX IF NOT EXISTS idx_inventory_history_inventoryItemId_date ON inventory_history (inventoryItemId, date);
    CREATE INDEX IF NOT EXISTS idx_invoices_listId ON invoices (listId);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items (invoiceId);
  `);
};
