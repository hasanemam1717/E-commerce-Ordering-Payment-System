/**
 * DTOs and type definitions for the Order domain module.
 */

/** Input item for creating an order */
export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

/** Input payload for createOrder */
export interface CreateOrderInput {
  userId: string;
  items: CreateOrderItemInput[];
}

/** A product snapshot validated during order creation */
export interface ValidatedProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  status: string;
}

/** An item in the order detail response */
export interface OrderItemResponse {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/** Order creation response DTO */
export interface OrderResponse {
  id: string;
  userId: string;
  status: string;
  total: number;
  items: OrderItemResponse[];
  createdAt: string;
}

/** Order list item (no nested items — lightweight) */
export interface OrderListItem {
  id: string;
  userId: string;
  status: string;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Order detail with items (full payload) */
export interface OrderDetailResponse {
  id: string;
  userId: string;
  userEmail: string;
  status: string;
  total: number;
  items: OrderItemResponse[];
  createdAt: string;
  updatedAt: string;
}

/** Paginated order list wrapper */
export interface PaginatedOrderResult {
  data: OrderListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Internal calculation state used during order processing */
export interface OrderCalculation {
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  total: number;
}
