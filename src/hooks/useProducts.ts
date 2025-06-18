// hooks/useProducts.ts
import { useState, useEffect, useCallback } from "react";
import { getProducts, updateProductOrder, saveProductHistory, Product } from "../database/database";
import { sortProducts, SortOrder } from "../utils/sortUtils";
import { preprocessName, calculateSimilarity } from "../utils/similarityUtils";

const searchSimilarityThreshold = 0.4;

export default function useProducts(listId: number, sortOrder: SortOrder, searchQuery: string) {
  const [products, setProducts] = useState<Product[]>([]);

  // --- Filtering Logic (memoized for performance) ---
  const filteredProducts = useCallback(() => {
    const filtered = products.filter((product) => {
      const processedProductName = preprocessName(product.name);
      const processedSearchQuery = preprocessName(searchQuery);

      if (!processedSearchQuery) {
        return true;
      }

      const nameLength = processedProductName.length;
      const queryLength = processedSearchQuery.length;
      const lengthThreshold = Math.ceil(nameLength * 0.5);

      if (queryLength < lengthThreshold) {
        return processedProductName.includes(processedSearchQuery);
      }

      const similarity = calculateSimilarity(processedProductName, processedSearchQuery);
      return similarity >= searchSimilarityThreshold;
    });
    return sortProducts(filtered, sortOrder, searchQuery); // Apply sort after filtering
  }, [products, searchQuery, sortOrder]);

  // --- Load Products Logic ---
  const loadProducts = useCallback(async () => {
    try {
      const loaded = await getProducts(listId);
      setProducts(loaded);
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    }
  }, [listId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // --- Product Order Handling Logic ---
  const handleProductOrderChange = useCallback(async (newOrder: Product[]) => {
    setProducts(newOrder); // Update UI immediately
    try {
      const updates = newOrder.map((product, index) => ({
        id: product.id,
        order: index,
      }));
      await updateProductOrder(updates);
    } catch (error) {
      console.error("Erro ao reordenar produtos:", error);
      loadProducts(); // Reload from DB if update fails
    }
  }, [loadProducts]);

  // Optionally, you could expose a way for useProduct to directly update the `products` state here
  // For instance, `updateProductState = (id, newQuantity) => { setProducts(prev => prev.map(...)) }`
  // But relying on `loadProducts` via `useFocusEffect` for general consistency is often simpler initially.
  // For deletion, `loadProducts` is definitely the way to go for now, as `useProduct` won't know about `filteredProducts`

  return {
    products, // Keep products for DraggableFlatList extraData
    filteredProducts: filteredProducts(), // Call the memoized function
    setProducts, // Potentially useful if external state manipulation is needed (e.g., import)
    loadProducts, // Expose for manual refresh
    handleProductOrderChange,
    saveProductHistory, 
  };
}