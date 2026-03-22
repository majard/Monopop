import { InventoryItem, Product } from '../database/models';

export type RootStackParamList = {
  MainTabs: { listId?: number };
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
  Lists: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 