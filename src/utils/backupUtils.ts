import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDb } from '../database/database';

const DB_VERSION = '1.0';

export interface ListExportData {
  type: 'list_export';
  version: string;
  exportedAt: string;
  listName: string;
  data: {
    categories: any[];
    stores: any[];
    products: any[];
    inventory_items: any[];
    inventory_history: any[];
    shopping_list_items: any[];
    invoices: any[];
    invoice_items: any[];
    product_store_prices: any[];
    product_base_prices: any[];
  };
}

const formatTimestamp = () =>
  new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', 'h');

export const shareJsonFile = async (jsonString: string, fileName: string) => {
  const cacheUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(cacheUri, jsonString);
  await Sharing.shareAsync(cacheUri, {
    mimeType: 'application/json',
    dialogTitle: `Compartilhar ${fileName}`,
  });
};

export const buildFullBackup = async () => {
  const db = getDb();

  const [
    categories, stores, products, lists,
    inventoryItems, inventoryHistory, shoppingListItems,
    invoices, invoiceItems, productStorePrices,
    productBasePrices, settings,
  ] = await Promise.all([
    db.getAllAsync('SELECT * FROM categories ORDER BY id'),
    db.getAllAsync('SELECT * FROM stores ORDER BY id'),
    db.getAllAsync('SELECT * FROM products ORDER BY id'),
    db.getAllAsync('SELECT * FROM lists ORDER BY id'),
    db.getAllAsync('SELECT * FROM inventory_items ORDER BY id'),
    db.getAllAsync('SELECT * FROM inventory_history ORDER BY id'),
    db.getAllAsync('SELECT * FROM shopping_list_items ORDER BY id'),
    db.getAllAsync('SELECT * FROM invoices ORDER BY id'),
    db.getAllAsync('SELECT * FROM invoice_items ORDER BY id'),
    db.getAllAsync('SELECT * FROM product_store_prices ORDER BY productId, storeId'),
    db.getAllAsync('SELECT * FROM product_base_prices ORDER BY productId'),
    db.getAllAsync('SELECT * FROM settings ORDER BY id'),
  ]);

  const exportData = {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      categories, stores, products, lists,
      inventory_items: inventoryItems,
      inventory_history: inventoryHistory,
      shopping_list_items: shoppingListItems,
      invoices, invoice_items: invoiceItems,
      product_store_prices: productStorePrices,
      product_base_prices: productBasePrices,
      settings,
    },
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const fileName = `monopop-backup-${formatTimestamp()}.json`;
  return { jsonString, fileName };
};

export const buildListExport = async (listId: number): Promise<{ jsonString: string; fileName: string }> => {
  const db = getDb();

  // Get the list itself
  const list = await db.getFirstAsync<{ id: number; name: string }>(
    'SELECT * FROM lists WHERE id = ?', [listId]
  );
  if (!list) throw new Error('List not found');

  // Get inventory items for this list
  const inventoryItems = await db.getAllAsync<any>(
    'SELECT * FROM inventory_items WHERE listId = ? ORDER BY id', [listId]
  );
  const inventoryItemIds = inventoryItems.map((i: any) => i.id);
  const productIds = [...new Set(inventoryItems.map((i: any) => i.productId as number))];

  // Get invoices for this list
  const invoices = await db.getAllAsync<any>(
    'SELECT * FROM invoices WHERE listId = ? ORDER BY id', [listId]
  );
  const invoiceIds = invoices.map((i: any) => i.id);

  // Parallel fetch of everything else
  const inList = (ids: number[]) =>
    ids.length > 0 ? `(${ids.join(',')})` : '(NULL)';

  const [
    products, categories, stores,
    inventoryHistory, shoppingListItems,
    invoiceItems, productStorePrices, productBasePrices,
  ] = await Promise.all([
    productIds.length > 0
      ? db.getAllAsync<any>(`SELECT * FROM products WHERE id IN ${inList(productIds)} ORDER BY id`)
      : Promise.resolve([]),
    // categories used by those products
    db.getAllAsync<any>(
      `SELECT DISTINCT c.* FROM categories c
       JOIN products p ON p.categoryId = c.id
       WHERE p.id IN ${inList(productIds)} ORDER BY c.id`
    ),
    // stores used by invoices or prices
    db.getAllAsync<any>(
      `SELECT * FROM stores WHERE id IN (
         SELECT DISTINCT storeId FROM invoices WHERE listId = ?
         UNION
         SELECT DISTINCT storeId FROM product_store_prices WHERE productId IN ${inList(productIds)}
       ) ORDER BY id`,
      [listId]
    ),
    inventoryItemIds.length > 0
      ? db.getAllAsync<any>(`SELECT * FROM inventory_history WHERE inventoryItemId IN ${inList(inventoryItemIds)} ORDER BY id`)
      : Promise.resolve([]),
    inventoryItemIds.length > 0
      ? db.getAllAsync<any>(`SELECT * FROM shopping_list_items WHERE inventoryItemId IN ${inList(inventoryItemIds)} ORDER BY id`)
      : Promise.resolve([]),
    invoiceIds.length > 0
      ? db.getAllAsync<any>(`SELECT * FROM invoice_items WHERE invoiceId IN ${inList(invoiceIds)} ORDER BY id`)
      : Promise.resolve([]),
    productIds.length > 0
      ? db.getAllAsync<any>(`SELECT * FROM product_store_prices WHERE productId IN ${inList(productIds)} ORDER BY productId, storeId`)
      : Promise.resolve([]),
    productIds.length > 0
      ? db.getAllAsync<any>(`SELECT * FROM product_base_prices WHERE productId IN ${inList(productIds)} ORDER BY productId`)
      : Promise.resolve([]),
  ]);

  const exportData: ListExportData = {
    type: 'list_export',
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    listName: list.name,
    data: {
      categories,
      stores,
      products,
      inventory_items: inventoryItems,
      inventory_history: inventoryHistory,
      shopping_list_items: shoppingListItems,
      invoices,
      invoice_items: invoiceItems,
      product_store_prices: productStorePrices,
      product_base_prices: productBasePrices,
    },
  };

  const safeName = list.name.replace(/[^a-z0-9]/gi, '_');
  const fileName = `monopop-lista-${safeName}-${formatTimestamp()}.json`;
  return { jsonString: JSON.stringify(exportData, null, 2), fileName };
};

export const detectImportType = (data: any): 'list_export' | 'full_backup' | 'invalid' => {
  if (data?.type === 'list_export' && data?.version && data?.data) {
    return 'list_export';
  }
  if (data?.tables && data?.version && data?.exportedAt && data?.tables?.lists) {
    return 'full_backup';
  }
  return 'invalid';
};