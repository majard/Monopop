import { useState, useEffect, useCallback } from "react";
import { getInventoryItems, updateInventoryItemOrder, saveInventoryHistorySnapshot } from "../database/database";
import { sortProducts, SortOrder } from "../utils/sortUtils";
import { preprocessName, calculateSimilarity } from "../utils/similarityUtils";
import { InventoryItem } from "../database/models";

const searchSimilarityThreshold = 0.4;

export default function useInventory(listId: number, sortOrder: SortOrder, searchQuery: string) {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  // --- Filtering Logic (memoized for performance) ---
  const filteredInventoryItems = useCallback(() => {
    const filtered = inventoryItems.filter((inventoryItem: InventoryItem) => {
      const processedInventoryItemName = preprocessName(inventoryItem.productName);
      const processedSearchQuery = preprocessName(searchQuery);

      if (!processedSearchQuery) {
        return true;
      }

      const nameLength = processedInventoryItemName.length;
      const queryLength = processedSearchQuery.length;
      const lengthThreshold = Math.ceil(nameLength * 0.5);

      if (queryLength < lengthThreshold) {
        return processedInventoryItemName.includes(processedSearchQuery);
      }

      const similarity = calculateSimilarity(processedInventoryItemName, processedSearchQuery);
      return similarity >= searchSimilarityThreshold;
    });
    return sortProducts(filtered, sortOrder, searchQuery); // Apply sort after filtering
  }, [inventoryItems, searchQuery, sortOrder]);

  // --- Load Products Logic ---
  const loadInventoryItems = useCallback(async () => {
    try {
      const loaded = await getInventoryItems(listId);
      console.log("Produtos carregados:", loaded);
      setInventoryItems(loaded);
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    }
  }, [listId]);

  useEffect(() => {
    loadInventoryItems();
  }, [loadInventoryItems]);

  // --- Product Order Handling Logic ---
  const handleProductOrderChange = useCallback(async (newOrder: InventoryItem[]) => {
    setInventoryItems(newOrder); // Update UI immediately
    try {
      const updates = newOrder.map((inventoryItem, index) => ({
        id: inventoryItem.id,
        sortOrder: index,
      }));
      await updateInventoryItemOrder(updates);
    } catch (error) {
      console.error("Erro ao reordenar produtos:", error);
      loadInventoryItems(); // Reload from DB if update fails
    }
  }, [loadInventoryItems]);

  // Optionally, you could expose a way for useProduct to directly update the `products` state here
  // For instance, `updateProductState = (id, newQuantity) => { setProducts(prev => prev.map(...)) }`
  // But relying on `loadProducts` via `useFocusEffect` for general consistency is often simpler initially.
  // For deletion, `loadProducts` is definitely the way to go for now, as `useProduct` won't know about `filteredProducts`

  return {
    inventoryItems, // Keep products for DraggableFlatList extraData
    filteredInventoryItems: filteredInventoryItems(), // Call the memoized function
    setInventoryItems, // Potentially useful if external state manipulation is needed (e.g., import)
    loadInventoryItems, // Expose for manual refresh
    handleProductOrderChange,
    saveInventoryHistorySnapshot, 
  };
}