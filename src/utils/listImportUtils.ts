import { getDb, addStore } from '../database/database';
import { ListExportData } from './backupUtils';

export interface ListImportResult {
  listName: string;
  categoriesCreated: number;
  storesCreated: number;
  productsMatched: number;
  productsCreated: number;
  inventoryItemsImported: number;
  invoicesImported: number;
}

export interface ProductResolution {
  oldProductId: number;
  newProductId: number;
}

// Called by useListImportEngine after product matching is complete
export const applyListImport = async (
  data: ListExportData,
  productResolutions: ProductResolution[],
): Promise<ListImportResult> => {
  const db = getDb();
  const now = new Date().toISOString();

  // ─── Build product ID map from resolutions ────────────────────────────────
  const productIdMap = new Map<number, number>();
  for (const r of productResolutions) {
    productIdMap.set(r.oldProductId, r.newProductId);
  }

  let categoriesCreated = 0;
  let storesCreated = 0;
  let productsMatched = 0;
  let productsCreated = 0;
  let listName = '';

  await db.withTransactionAsync(async () => {
    // ─── Step 1: Categories ───────────────────────────────────────────────────
    const categoryIdMap = new Map<number, number>();
    for (const cat of data.data.categories) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM categories WHERE name = ?', [cat.name]
      );
      if (existing) {
        categoryIdMap.set(cat.id, existing.id);
      } else {
        const result = await db.runAsync(
          'INSERT INTO categories (name, createdAt, updatedAt) VALUES (?, ?, ?)',
          [cat.name, now, now]
        );
        categoryIdMap.set(cat.id, result.lastInsertRowId);
        categoriesCreated++;
      }
    }

    // ─── Step 2: Stores ───────────────────────────────────────────────────────
    const storeIdMap = new Map<number, number>();
    for (const store of data.data.stores) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM stores WHERE name = ?', [store.name]
      );
      if (existing) {
        storeIdMap.set(store.id, existing.id);
      } else {
        const newId = await addStore(store.name);
        storeIdMap.set(store.id, newId);
        storesCreated++;
      }
    }

    // ─── Step 3: Update product categoryIds using categoryIdMap ──────────────
    // Products were already created/matched by useListImportEngine
    // but their categoryIds need remapping
    for (const product of data.data.products) {
      const newProductId = productIdMap.get(product.id);
      if (!newProductId) continue;
      const newCategoryId = product.categoryId
        ? categoryIdMap.get(product.categoryId) ?? null
        : null;
      if (newCategoryId !== null) {
        await db.runAsync(
          'UPDATE products SET categoryId = ? WHERE id = ?',
          [newCategoryId, newProductId]
        );
      }
      if (productResolutions.find(r => r.oldProductId === product.id && r.newProductId !== product.id)) {
        productsCreated++;
      } else {
        productsMatched++;
      }
    }

    // ─── Step 4: Create list ──────────────────────────────────────────────────
    listName = data.listName;
    const existingList = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM lists WHERE name = ?', [listName]
    );
    if (existingList) {
      listName = `${listName} (importada)`;
    }
    const maxOrder = await db.getFirstAsync<{ maxOrder: number }>(
      'SELECT MAX("order") as maxOrder FROM lists'
    );
    const listResult = await db.runAsync(
      'INSERT INTO lists (name, "order") VALUES (?, ?)',
      [listName, (maxOrder?.maxOrder ?? 0) + 1]
    );
    const newListId = listResult.lastInsertRowId;

    // ─── Step 5: Inventory items ──────────────────────────────────────────────
    const inventoryItemIdMap = new Map<number, number>();
    for (const item of data.data.inventory_items) {
      const newProductId = productIdMap.get(item.productId);
      if (!newProductId) continue;
      const result = await db.runAsync(
        `INSERT INTO inventory_items
           (listId, productId, quantity, sortOrder, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newListId, newProductId, item.quantity, item.sortOrder,
         item.notes ?? null, item.createdAt, item.updatedAt]
      );
      inventoryItemIdMap.set(item.id, result.lastInsertRowId);
    }

    // ─── Step 6: Inventory history ────────────────────────────────────────────
    for (const h of data.data.inventory_history) {
      const newInventoryItemId = inventoryItemIdMap.get(h.inventoryItemId);
      if (!newInventoryItemId) continue;
      await db.runAsync(
        `INSERT INTO inventory_history
           (inventoryItemId, quantity, date, notes, createdAt)
         VALUES (?, ?, ?, ?, ?)`,
        [newInventoryItemId, h.quantity, h.date, h.notes ?? null, h.createdAt]
      );
    }

    // ─── Step 7: Shopping list items ──────────────────────────────────────────
    for (const sli of data.data.shopping_list_items) {
      const newInventoryItemId = inventoryItemIdMap.get(sli.inventoryItemId);
      if (!newInventoryItemId) continue;
      await db.runAsync(
        `INSERT INTO shopping_list_items
           (inventoryItemId, quantity, checked, price, packageSize,
            sortOrder, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newInventoryItemId, sli.quantity, sli.checked, sli.price ?? null,
         sli.packageSize ?? null, sli.sortOrder, sli.notes ?? null,
         sli.createdAt, sli.updatedAt]
      );
    }

    // ─── Step 8: Invoices ─────────────────────────────────────────────────────
    const invoiceIdMap = new Map<number, number>();
    for (const invoice of data.data.invoices) {
      const newStoreId = storeIdMap.get(invoice.storeId);
      if (!newStoreId) continue;
      const result = await db.runAsync(
        `INSERT INTO invoices (storeId, listId, total, createdAt)
         VALUES (?, ?, ?, ?)`,
        [newStoreId, newListId, invoice.total, invoice.createdAt]
      );
      invoiceIdMap.set(invoice.id, result.lastInsertRowId);
    }

    // ─── Step 9: Invoice items ────────────────────────────────────────────────
    for (const ii of data.data.invoice_items) {
      const newInvoiceId = invoiceIdMap.get(ii.invoiceId);
      const newProductId = productIdMap.get(ii.productId);
      if (!newInvoiceId || !newProductId) continue;
      await db.runAsync(
        `INSERT INTO invoice_items
           (invoiceId, productId, quantity, unitPrice, lineTotal, packageSize, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newInvoiceId, newProductId, ii.quantity, ii.unitPrice ?? null,
         ii.lineTotal, ii.packageSize ?? null, ii.createdAt]
      );
    }

    // ─── Step 10: Product store prices ───────────────────────────────────────
    for (const psp of data.data.product_store_prices) {
      const newProductId = productIdMap.get(psp.productId);
      const newStoreId = storeIdMap.get(psp.storeId);
      if (!newProductId || !newStoreId) continue;
      await db.runAsync(
        `INSERT OR IGNORE INTO product_store_prices
           (productId, storeId, price, packageSize, updatedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [newProductId, newStoreId, psp.price, psp.packageSize ?? null, psp.updatedAt]
      );
    }

    // ─── Step 11: Product base prices ────────────────────────────────────────
    for (const pbp of data.data.product_base_prices) {
      const newProductId = productIdMap.get(pbp.productId);
      if (!newProductId) continue;
      await db.runAsync(
        `INSERT OR IGNORE INTO product_base_prices
           (productId, price, packageSize, updatedAt)
         VALUES (?, ?, ?, ?)`,
        [newProductId, pbp.price, pbp.packageSize ?? null, pbp.updatedAt]
      );
    }
  });

  return {
    listName,
    categoriesCreated,
    storesCreated,
    productsMatched,
    productsCreated,
    inventoryItemsImported: data.data.inventory_items.length,
    invoicesImported: data.data.invoices.length,
  };
};