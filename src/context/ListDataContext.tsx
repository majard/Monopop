import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { getInventoryItems, getCategories, getStores, getSetting, getLastStoreName } from '../database/database';
import { InventoryItem, Category } from '../database/models';
import { useListContext } from './ListContext';

interface Store {
  id: number;
  name: string;
}

interface ListDataContextValue {
  inventoryItems: InventoryItem[];
  categories: Category[];
  stores: Store[];
  defaultStoreMode: string | null;
  defaultStoreId: string | null;
  lastStoreName: string | null;
  loadInventoryItems: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadStores: () => Promise<void>;
  refreshStoreSettings: () => Promise<void>;
  findByProductId: (productId: number) => InventoryItem | undefined;
}

const ListDataContext = createContext<ListDataContextValue | undefined>(undefined);

export const useListData = () => {
  const context = useContext(ListDataContext);
  if (!context) {
    throw new Error('useListData must be used within a ListDataProvider');
  }
  return context;
};

interface ListDataProviderProps {
  children: ReactNode;
}

export const ListDataProvider: React.FC<ListDataProviderProps> = ({ children }) => {
  const { listId } = useListContext();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [defaultStoreMode, setDefaultStoreMode] = useState<string | null>(null);
  const [defaultStoreId, setDefaultStoreId] = useState<string | null>(null);
  const [lastStoreName, setLastStoreName] = useState<string | null>(null);

  const loadInventoryItems = useCallback(async () => {
    const items = await getInventoryItems(listId);
    setInventoryItems(items);
  }, [listId]);

  const loadCategories = useCallback(async () => {
    const cats = await getCategories();
    setCategories(cats);
  }, []);

  const loadStores = useCallback(async () => {
    const storeList = await getStores();
    setStores(storeList);
  }, []);

  const findByProductId = useCallback((productId: number) => {
    return inventoryItems.find(item => item.productId === productId);
  }, [inventoryItems]);

  const loadStoreSettings = useCallback(async () => {
    const [mode, id, storeName] = await Promise.all([
      getSetting('defaultStoreMode'),
      getSetting('defaultStoreId'),
      getLastStoreName(),
    ]);
    setDefaultStoreMode(mode);
    setDefaultStoreId(id);
    setLastStoreName(storeName);
  }, []);

  // Load all data when listId changes
  useEffect(() => {
    const loadAllData = async () => {
      await Promise.all([
        loadInventoryItems(),
        loadCategories(),
        loadStores(),
        loadStoreSettings()
      ]);
    };
    loadAllData();
  }, [listId, loadInventoryItems, loadCategories, loadStores, loadStoreSettings]);

  const value: ListDataContextValue = {
    inventoryItems,
    categories,
    stores,
    defaultStoreMode,
    defaultStoreId,
    lastStoreName,
    loadInventoryItems,
    loadCategories,
    loadStores,
    refreshStoreSettings: loadStoreSettings,
    findByProductId,
  };

  return (
    <ListDataContext.Provider value={value}>
      {children}
    </ListDataContext.Provider>
  );
};
