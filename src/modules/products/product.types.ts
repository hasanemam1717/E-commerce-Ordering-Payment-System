/** Product module type definitions */

/** Public product response (what the API returns) */
export interface ProductResponse {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: number;
  stock: number;
  status: 'ACTIVE' | 'INACTIVE';
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Filtering & pagination query params for listing products */
export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

/** Paginated product list wrapper */
export interface PaginatedProductResult {
  data: ProductResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
