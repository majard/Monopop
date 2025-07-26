import { InventoryItem, Product } from '../database/models';

export type RootStackParamList = {
  Home: { listId?: number };
  AddProduct: {listId: number};
  EditProduct: { product: Product };
  EditInventoryItem: {inventoryItem: InventoryItem}
  Lists: undefined;
  AddList: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 