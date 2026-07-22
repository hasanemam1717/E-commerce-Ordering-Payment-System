/**
 * Type definitions for the Category module tree traversal.
 */

/** A product summary nested inside a category tree node */
export interface CategoryProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

/** A single node in the recursive category tree */
export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: CategoryTreeNode[];
  products: CategoryProduct[];
}

/** The top-level result returned by getCategoryTreeWithProducts */
export interface CategoryTreeResult {
  category: CategoryTreeNode;
  totalProducts: number;
  depth: number;
}

/** Internal in-memory representation of a category used during DFS assembly */
export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

/** Internal in-memory representation of an active product used during DFS assembly */
export interface ProductRow {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  categoryId: string | null;
}
