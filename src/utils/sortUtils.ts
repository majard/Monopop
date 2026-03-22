import { Product } from "../database/database";
import { calculateSimilarity, preprocessName } from "./similarityUtils";

export type SortOrder = "custom" | "alphabetical" | "quantityAsc" | "quantityDesc";

/**
 * Sorts a list of products either by similarity to a search query or by the specified sort order.
 *
 * When `searchQuery` is non-empty (after trimming), products are ordered by descending name similarity to the processed query.
 * Otherwise the `sortOrder` is applied:
 * - "alphabetical": ascending by `name`
 * - "quantityAsc": ascending by `quantity`
 * - "quantityDesc": descending by `quantity`
 * - "custom": ascending by `order`
 *
 * @param products - The array of products to sort (not mutated; a shallow copy is returned)
 * @param sortOrder - The sort strategy to use when `searchQuery` is empty
 * @param searchQuery - The search string whose similarity to product names takes precedence when non-empty
 * @returns The sorted array of products
 */
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