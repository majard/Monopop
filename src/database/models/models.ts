export interface Product {
  id: number;
  name: string; // "Rice", "Coffee", "Shampoo"
  categoryId?: number; // FK to Category 
  categoryName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface InventoryItem {
  id: number;
  listId: number; // FK to List
  productId: number; // FK to Product (generic)
  quantity: number; // Current quantity of the *generic Product* (e.g., 3 units of "Rice")
  sortOrder: number;
  notes?: string; // Notes about this inventory item (optional as per DB schema)
  updatedAt: string; // When was this stock last updated?
  createdAt: string;
  productName: string;
  categoryId?: number | null;
  categoryName?: string | null;
}

export interface InventoryHistory {
  id: number;
  inventoryItemId: number; // CRITICAL: FK to InventoryItem (as per V2 migration)
  date: string; // ISO-MM-DD
  quantity: number;
  notes?: string; // Optional notes for the history entry (optional as per DB schema)
  createdAt: string;
}

export interface List {
  id: number;
  name: string;
  order: number;
}

export interface ShoppingListItem {
  id: number;
  inventoryItemId: number; // CRITICAL: FK to InventoryItem (as per V2 migration)
  quantity: number; // Desired quantity of the *specific InventoryItem* for purchase
  checked: number; // SQLite stores as 0 or 1, but should be converted to boolean in UI
  price?: number;
  sortOrder: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: number;
  name: string;
  createdAt: string;
}

export interface Invoice {
  id: number;
  storeId: number;
  listId: number;
  total: number;
  createdAt: string;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number;
  quantity: number;
  unitPrice?: number | null;
  lineTotal: number;
  createdAt: string;
}