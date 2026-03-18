import { InventoryItem, Product } from '../database/models';
import { ListExportData } from '../utils/backupUtils';

export type RootStackParamList = {
  Lists: undefined;
  MainTabs: { listId?: number, screen?: keyof BottomTabParamList };
  AddProduct: {listId: number};
  AddInventoryItem: {listId: number};
  EditProduct: { product: Product };
  EditInventoryItem: {inventoryItem: InventoryItem}
  AddList: undefined;
  ShoppingList: {listId: number};
  AddProductToShoppingList: { listId: number };
  Config: undefined;
  Products: undefined;
  Stores: undefined;
  Categories: undefined;
  Invoices: undefined;
  InvoiceDetail: { invoiceId: number };
  Backup: {
    pendingListImport?: ListExportData;
    pendingBackupImport?: any;
  } | undefined;
  About: undefined;
  Preferences: undefined;
};

export type BottomTabParamList = {
  Inventory: { listId?: number };
  ShoppingList: { listId?: number };
  History: { listId?: number };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}