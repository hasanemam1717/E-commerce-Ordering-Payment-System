import { z } from 'zod';

/** Validate query params for GET /api/orders */
export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PAID', 'CANCELED']).optional(),
});

/** Validate PATCH /api/orders/:id/status body */
export const updateOrderStatusSchema = z
  .object({
    status: z.enum(['PENDING', 'PAID', 'CANCELED'], {
      required_error: 'Status is required',
      invalid_type_error: 'Status must be one of: PENDING, PAID, CANCELED',
    }),
  })
  .strict();

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
