import { Product } from "../database/database";
import { calculateSimilarity, preprocessName } from "./similarityUtils";

export type SortOrder = "custom" | "alphabetical" | "quantityAsc" | "quantityDesc";

export interface SortableInventoryItem {
  productName: string;
  quantity: number;
  sortOrder: number;
}

export function sortInventoryItems<T extends SortableInventoryItem>(
  items: T[],
  sortOrder: SortOrder,
  searchQuery: string
): T[] {
  const sorted = [...items];
  if (searchQuery.trim()) {
    const processedQuery = preprocessName(searchQuery);
    sorted.sort((a, b) => {
      const similarityA = calculateSimilarity(processedQuery, preprocessName(a.productName));
      const similarityB = calculateSimilarity(processedQuery, preprocessName(b.productName));
      return similarityB - similarityA;
    });
    return sorted;
  }
  switch (sortOrder) {
    case "alphabetical":
      sorted.sort((a, b) => a.productName.localeCompare(b.productName));
      break;
    case "quantityAsc":
      sorted.sort((a, b) => a.quantity - b.quantity);
      break;
    case "quantityDesc":
      sorted.sort((a, b) => b.quantity - a.quantity);
      break;
    default:
      sorted.sort((a, b) => a.sortOrder - b.sortOrder);
      break;
  }
  return sorted;
}

export function sortProducts(
    products: Product[], 
    sortOrder: SortOrder,
    searchQuery: string
) {
    const sortedProducts = [...products]
    
    // If there's a search query, sort by similarity
    if (searchQuery.trim()) {
        const processedQuery = preprocessName(searchQuery);
        sortedProducts.sort((a, b) => {
          const similarityA = calculateSimilarity(
            processedQuery,
            preprocessName(a.name)
          );
          const similarityB = calculateSimilarity(
            processedQuery,
            preprocessName(b.name)
          );
          return similarityB - similarityA;
        });
        return sortedProducts;
      }
  
      // Otherwise use the selected sort order
      switch (sortOrder) {
        case "alphabetical":
          sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case "quantityAsc":
          sortedProducts.sort((a, b) => a.quantity - b.quantity);
          break;
        case "quantityDesc":
          sortedProducts.sort((a, b) => b.quantity - a.quantity);
          break;
        default:
          sortedProducts.sort((a, b) => a.order - b.order);
          break;
      }
      return sortedProducts;
  
}