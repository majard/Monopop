import { calculateSimilarity, preprocessName } from "./similarityUtils";

export type SortOrder = "custom" | "alphabetical" | "category" | "quantityAsc" | "quantityDesc" | "stockAsc" | "stockDesc";

export interface SortableItem {
  productName: string;
  quantity?: number;
  sortOrder?: number;
  categoryName?: string | null;
  stockQuantity?: number;
}

export function sortItems<T extends SortableItem>(
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
    case "category":
      sorted.sort((a, b) => {
        const catA = a.categoryName ?? 'zzz';
        const catB = b.categoryName ?? 'zzz';
        if (catA !== catB) return catA.localeCompare(catB);
        return a.productName.localeCompare(b.productName);
      });
      break;
    case "quantityAsc":
      sorted.sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));
      break;
    case "quantityDesc":
      sorted.sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0));
      break;
    case "stockAsc":
      sorted.sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0));
      break;
    case "stockDesc":
      sorted.sort((a, b) => (b.stockQuantity ?? 0) - (a.stockQuantity ?? 0));
      break;
    default: // custom
      sorted.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      break;
  }
  return sorted;
}

// Keep sortInventoryItems as alias for backwards compatibility
export const sortInventoryItems = sortItems;
// Keep sortProducts as alias for backwards compatibility  
export const sortProducts = sortItems;