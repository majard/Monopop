import { InventoryItem, Product } from '../database/models';

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