import { useCallback } from "react";
import { updateInventoryItemOrder, saveInventoryHistorySnapshot } from "../database/database";
import { sortInventoryItems, SortOrder } from "../utils/sortUtils";
import { preprocessName, calculateSimilarity } from "../utils/similarityUtils";
import { InventoryItem } from "../database/models";
import { useListData } from "../context/ListDataContext";

const searchSimilarityThreshold = 0.4;

export default function useInventory(listId: number, sortOrder: SortOrder, searchQuery: string) {
  const { inventoryItems, loadInventoryItems: loadInventoryItemsFromContext, findByProductId: findByProductIdFromContext } = useListData();

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
    return sortInventoryItems(filtered, sortOrder, searchQuery); // Apply sort after filtering
  }, [inventoryItems, searchQuery, sortOrder]);

  // --- Load Products Logic ---
  // Note: listId parameter is ignored as inventory is now owned by context
  const loadInventoryItems = useCallback(async () => {
    await loadInventoryItemsFromContext();
  }, [loadInventoryItemsFromContext]);

  // --- Product Order Handling Logic ---
  const handleProductOrderChange = useCallback(async (newOrder: InventoryItem[]) => {
    const reindexed = newOrder.map((item, index) => ({ ...item, sortOrder: index }));
    try {
      const updates = reindexed.map(item => ({ id: item.id, sortOrder: item.sortOrder }));
      await updateInventoryItemOrder(updates);
      // Reload inventory from context to get updated state
      await loadInventoryItemsFromContext();
    } catch (error) {
      console.error("Erro ao reordenar produtos:", error);
      loadInventoryItems();
    }
  }, [loadInventoryItemsFromContext, loadInventoryItems]);

  // Optionally, you could expose a way for useProduct to directly update the `products` state here
  // For instance, `updateProductState = (id, newQuantity) => { setProducts(prev => prev.map(...)) }`
  // But relying on `loadProducts` via `useFocusEffect` for general consistency is often simpler initially.
  // For deletion, `loadProducts` is definitely the way to go for now, as `useProduct` won't know about `filteredProducts`

  // --- Find by ID Logic ---
  // Use the context's findByProductId function
  const findByProductId = useCallback((productId: number) => {
    return findByProductIdFromContext(productId);
  }, [findByProductIdFromContext]);

  return {
    inventoryItems, // From context
    filteredInventoryItems: filteredInventoryItems(), // Call the memoized function
    setInventoryItems: () => {}, // No-op - inventory is managed by context
    loadInventoryItems, // Expose for manual refresh (calls context)
    handleProductOrderChange,
    saveInventoryHistorySnapshot,
    findByProductId, // From context
  };
}