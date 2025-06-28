export interface Product {
    id: number;
    name: string; // "Rice", "Coffee", "Shampoo"
    categoryId?: number; // FK to Category
    createdAt: string;
    updatedAt: string;
  }
  
  export interface Category {
    id: number;
    name: string;
  }
  
  export interface InventoryItem {
    id: number;
    listId: number; // FK to Context
    productId: number; // FK to Product (generic)
    quantity: number; // Current quantity of the *generic Product* (e.g., 3 units of "Rice")
    sortOrder: number;
    notes?: string; // Notes about this inventory item
    updatedAt: string; // When was this stock last updated?
    createdAt: string;
  }
  
  export interface InventoryHistory {
    id: number;
    listId: number; // FK to List
    productId: number; // FK to Product (generic)
    date: string; // YYYY-MM-DD
    quantity: number;
    notes?: string; // Optional notes for the history entry
    createdAt: string;
  }
  
  export interface List {
    id: number;
    name: string;
    order: number;
  }
  
  export interface ShoppingListItem {
    id: number;
    listId: number; // FK to List
    productId: number; // FK to Product (generic)
    quantity: number; // Desired quantity of the *generic Product*
    checked: boolean; // True if item has been put in cart/purchased
    price: number;
    sortOrder: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  }
  
  