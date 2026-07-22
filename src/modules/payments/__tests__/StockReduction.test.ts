/**
 * Stock Reduction tests — validates race-condition-safe atomic stock
 * decrement logic in PaymentService.handlePaymentSuccess.
 *
 * The key invariant under test:
 *   "Stock must never go negative and concurrent requests must not
 *    cause overselling."
 *
 * We test this by mocking the Prisma interactive transaction callback
 * and verifying the stock decrement condition.
 */

// Must mock Stripe before any imports to prevent constructor validation error
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

import { PrismaClient } from '@prisma/client';
import { PaymentService } from '../payment.service';

// ─── Mocks ─────────────────────────────────────────────────
const mockTx = {
  payment: { findUnique: jest.fn(), update: jest.fn() },
  order: { update: jest.fn() },
  product: { updateMany: jest.fn() },
  $queryRaw: jest.fn(),
};

const mockPrisma = {
  payment: { findUnique: jest.fn(), update: jest.fn() },
  order: { update: jest.fn() },
  product: { updateMany: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

function createService(): PaymentService {
  return new PaymentService(mockPrisma as unknown as PrismaClient);
}

beforeEach(() => {
  jest.resetAllMocks();
  // Default: $transaction executes the callback with mockTx
  mockPrisma.$transaction.mockImplementation(
    (cb: (tx: any) => Promise<void>) => cb(mockTx),
  );
});

// ════════════════════════════════════════════════════════════
//  Fixtures
// ════════════════════════════════════════════════════════════

function buildPaymentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    orderId: 'order-1',
    transactionId: 'pi_test_123',
    provider: 'STRIPE',
    status: 'PENDING',
    rawResponse: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: {
      id: 'order-1',
      userId: 'user-1',
      status: 'PENDING',
      totalAmount: 2999.98,
      items: [
        {
          id: 'oi-1',
          orderId: 'order-1',
          productId: 'p-macbook',
          quantity: 2,
          price: 1499.99,
          subtotal: 2999.98,
          product: { id: 'p-macbook', name: 'MacBook Pro', stock: 10 },
        },
      ],
    },
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════
//  Happy Path
// ════════════════════════════════════════════════════════════

describe('Stock Reduction — Happy Path', () => {
  it('updates payment to SUCCESS, order to PAID, and decrements stock atomically', async () => {
    const payment = buildPaymentFixture();
    mockTx.payment.findUnique.mockResolvedValue(payment);
    mockTx.payment.update.mockResolvedValue({ ...payment, status: 'SUCCESS' });
    mockTx.order.update.mockResolvedValue({ ...payment.order, status: 'PAID' });
    mockTx.product.updateMany.mockResolvedValue({ count: 1 });

    await createService().handlePaymentSuccess(
      'pi_test_123',
      'STRIPE',
      { status: 'succeeded' },
    );

    // Payment updated to SUCCESS
    expect(mockTx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'SUCCESS' }),
      }),
    );

    // Order updated to PAID
    expect(mockTx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: { status: 'PAID' },
      }),
    );

    // Stock decremented atomically with guard
    expect(mockTx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p-macbook', stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
  });
});

// ════════════════════════════════════════════════════════════
//  Idempotency — Already Processed
// ════════════════════════════════════════════════════════════

describe('Stock Reduction — Idempotency', () => {
  it('skips processing if payment status is already SUCCESS', async () => {
    const payment = buildPaymentFixture({ status: 'SUCCESS' });
    mockTx.payment.findUnique.mockResolvedValue(payment);

    await createService().handlePaymentSuccess(
      'pi_test_123',
      'STRIPE',
      {},
    );

    // No mutations were made
    expect(mockTx.payment.update).not.toHaveBeenCalled();
    expect(mockTx.order.update).not.toHaveBeenCalled();
    expect(mockTx.product.updateMany).not.toHaveBeenCalled();
  });

  it('silently skips if payment record is not found', async () => {
    mockTx.payment.findUnique.mockResolvedValue(null);

    await createService().handlePaymentSuccess(
      'txn_not_found',
      'STRIPE',
      {},
    );

    expect(mockTx.payment.update).not.toHaveBeenCalled();
    expect(mockTx.order.update).not.toHaveBeenCalled();
    expect(mockTx.product.updateMany).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════
//  Race Condition — Insufficient Stock
// ════════════════════════════════════════════════════════════

describe('Stock Reduction — Race Conditions', () => {
  it('throws an error if updateMany returns count 0 (stock race lost)', async () => {
    const payment = buildPaymentFixture();
    mockTx.payment.findUnique.mockResolvedValue(payment);
    mockTx.payment.update.mockResolvedValue({ ...payment, status: 'SUCCESS' });
    mockTx.order.update.mockResolvedValue({ ...payment.order, status: 'PAID' });

    // Simulate failed stock decrement — product was sold out between
    // read and write
    mockTx.product.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createService().handlePaymentSuccess('pi_test_123', 'STRIPE', {}),
    ).rejects.toThrow(/Insufficient stock for product/);
  });

  it('processes multiple line items correctly', async () => {
    const multiItemPayment = buildPaymentFixture({
      order: {
        id: 'order-2',
        userId: 'user-1',
        status: 'PENDING',
        totalAmount: 250.00,
        items: [
          {
            id: 'oi-1',
            orderId: 'order-2',
            productId: 'p-mouse',
            quantity: 3,
            price: 25.00,
            subtotal: 75.00,
            product: { id: 'p-mouse', name: 'Mouse', stock: 10 },
          },
          {
            id: 'oi-2',
            orderId: 'order-2',
            productId: 'p-keyboard',
            quantity: 1,
            price: 75.00,
            subtotal: 75.00,
            product: { id: 'p-keyboard', name: 'Keyboard', stock: 5 },
          },
        ],
      },
    });

    mockTx.payment.findUnique.mockResolvedValue(multiItemPayment);
    mockTx.payment.update.mockResolvedValue({ ...multiItemPayment, status: 'SUCCESS' });
    mockTx.order.update.mockResolvedValue({ ...multiItemPayment.order, status: 'PAID' });
    mockTx.product.updateMany.mockResolvedValue({ count: 1 });

    await createService().handlePaymentSuccess('pi_test_456', 'STRIPE', {});

    // Both products should be decremented
    expect(mockTx.product.updateMany).toHaveBeenCalledTimes(2);
    expect(mockTx.product.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'p-mouse', stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
    expect(mockTx.product.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'p-keyboard', stock: { gte: 1 } },
      data: { stock: { decrement: 1 } },
    });
  });
});

// ════════════════════════════════════════════════════════════
//  Concurrency — FOR UPDATE Lock
// ════════════════════════════════════════════════════════════

describe('Stock Reduction — FOR UPDATE Lock', () => {
  it('executes $queryRaw FOR UPDATE before decrementing stock', async () => {
    const payment = buildPaymentFixture();
    mockTx.payment.findUnique.mockResolvedValue(payment);
    mockTx.payment.update.mockResolvedValue({ ...payment, status: 'SUCCESS' });
    mockTx.order.update.mockResolvedValue({ ...payment.order, status: 'PAID' });
    mockTx.product.updateMany.mockResolvedValue({ count: 1 });

    await createService().handlePaymentSuccess('pi_test_123', 'STRIPE', {});

    // FOR UPDATE lock should be acquired before stock decrement
    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);

    // Verify FOR UPDATE is in the raw SQL string
    const callArg = mockTx.$queryRaw.mock.calls[0]![0];
    const rawSql = typeof callArg === 'string' ? callArg : JSON.stringify(callArg);
    expect(rawSql).toContain('FOR UPDATE');

    // Lock happens before updateMany
    const queryRawOrder = mockTx.$queryRaw.mock.invocationCallOrder[0];
    const updateManyOrder = mockTx.product.updateMany.mock.invocationCallOrder[0];
    expect(queryRawOrder).toBeLessThan(updateManyOrder);
  });
});
