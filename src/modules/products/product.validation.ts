import { z } from 'zod';

/** Validate POST /api/products body */
export const createProductSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    sku: z.string().min(1, 'SKU is required').max(100),
    description: z.string().max(2000).optional(),
    price: z.number().positive('Price must be positive').or(z.string().regex(/^\d+(\.\d{1,2})?$/)).transform(Number),
    stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
    categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  })
  .strict();

/** Validate PATCH /api/products/:id body */
export const updateProductSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
    price: z.number().positive('Price must be positive').or(z.string().regex(/^\d+(\.\d{1,2})?$/)).transform(Number).optional(),
    stock: z.number().int().min(0).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/** Validate query params for GET /api/products */
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
