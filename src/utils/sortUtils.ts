import { Product } from "../database/database";
import { calculateSimilarity, preprocessName } from "./similarityUtils";

export type SortOrder = "custom" | "alphabetical" | "quantityAsc" | "quantityDesc";

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