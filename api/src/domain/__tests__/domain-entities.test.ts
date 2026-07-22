import { BadRequestError } from '../../common/utils/AppError';
import { InsufficientStockError, InvalidOrderStateError } from '../errors';
import { Order } from '../entities/order';
import { Product } from '../entities/product';

describe('Order domain model', () => {
  it('calculates totals with discounts applied', () => {
    const order = new Order({
      id: 'order-1',
      userId: 'user-1',
      items: [
        { productId: 'p-1', quantity: 2, unitPrice: 100 },
        { productId: 'p-2', quantity: 1, unitPrice: 50 },
      ],
      discountPercent: 10,
    });

    expect(order.calculateTotal()).toBe(225);
    expect(order.canBeCancelled()).toBe(true);
  });

  it('allows processing and paid transitions only from valid states', () => {
    const pendingOrder = new Order({
      id: 'order-2',
      userId: 'user-2',
      items: [{ productId: 'p-1', quantity: 1, unitPrice: 20 }],
    });

    pendingOrder.transitionToProcessing();
    expect(pendingOrder.status).toBe('PROCESSING');

    pendingOrder.transitionToPaid();
    expect(pendingOrder.status).toBe('PAID');
  });

  it('prevents cancellation for already paid or completed orders', () => {
    const paidOrder = new Order({
      id: 'order-3',
      userId: 'user-3',
      items: [{ productId: 'p-1', quantity: 1, unitPrice: 10 }],
      status: 'PAID',
    });

    expect(() => paidOrder.cancel()).toThrow(InvalidOrderStateError);
  });
});

describe('Product domain model', () => {
  it('decreases stock and rejects insufficient stock', () => {
    const product = new Product({
      id: 'prod-1',
      name: 'Keyboard',
      sku: 'KB-001',
      price: 30,
      stock: 5,
    });

    product.decreaseStock(2);
    expect(product.stock).toBe(3);

    expect(() => product.decreaseStock(10)).toThrow(InsufficientStockError);
    expect(product.stock).toBe(3);
  });

  it('releases stock and validates invalid values', () => {
    const product = new Product({
      id: 'prod-2',
      name: 'Mouse',
      sku: 'MS-001',
      price: 15,
      stock: 2,
    });

    product.releaseStock(3);
    expect(product.stock).toBe(5);

    expect(
      () => new Product({ id: 'prod-3', name: 'Bad', sku: 'BAD', price: 12, stock: -1 }),
    ).toThrow(BadRequestError);
  });
});
