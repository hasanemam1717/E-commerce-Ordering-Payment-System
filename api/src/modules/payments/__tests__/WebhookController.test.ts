import type { PaymentService } from '../payment.service';

const mockConstructEvent = jest.fn();
const mockTryAcquireLock = jest.fn();
const mockHandleWebhook = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }));
});

jest.mock('../../../config/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    BKASH_APP_KEY: 'bkash-app-key',
  },
}));

jest.mock('../../../config/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../config/redis', () => ({
  redis: {
    setnx: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../payment.context', () => ({
  PaymentContext: {
    handleWebhook: mockHandleWebhook,
  },
}));

jest.mock('../webhook.idempotency', () => ({
  WebhookIdempotencyService: jest.fn().mockImplementation(() => ({
    tryAcquireLock: mockTryAcquireLock,
  })),
}));

import { WebhookController } from '../webhook.controller';

describe('WebhookController', () => {
  const paymentService = {
    handlePaymentSuccess: jest.fn(),
  } as unknown as PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTryAcquireLock.mockReset();
    mockConstructEvent.mockReset();
    mockHandleWebhook.mockReset();
  });

  it('processes a valid Stripe success event and delegates stock reduction', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: { order_id: 'order-123' },
        },
      },
    });
    mockTryAcquireLock.mockResolvedValue(true);

    const controller = new WebhookController(paymentService);
    const result = await controller.handleStripeWebhook(Buffer.from('payload'), 'sig_123');

    expect(result.statusCode).toBe(200);
    expect(paymentService.handlePaymentSuccess).toHaveBeenCalledWith(
      'pi_123',
      'STRIPE',
      expect.anything(),
    );
  });

  it('ignores duplicate Stripe webhooks', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_dup',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_dup', metadata: { order_id: 'order-dup' } } },
    });
    mockTryAcquireLock.mockResolvedValue(false);

    const controller = new WebhookController(paymentService);
    const result = await controller.handleStripeWebhook(Buffer.from('payload'), 'sig_123');

    expect(result.statusCode).toBe(200);
    expect(paymentService.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('returns early for Stripe requests missing a signature header', async () => {
    const controller = new WebhookController(paymentService);
    const result = await controller.handleStripeWebhook(Buffer.from('payload'), undefined);

    expect(result.statusCode).toBe(200);
    expect(paymentService.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('rejects bKash webhooks with mismatched app keys', async () => {
    const controller = new WebhookController(paymentService);
    const result = await controller.handleBkashWebhook(
      Buffer.from(JSON.stringify({ paymentID: 'pay_1' })),
      'wrong-key',
    );

    expect(result.statusCode).toBe(200);
    expect(paymentService.handlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('processes successful bKash webhooks via the payment context', async () => {
    mockTryAcquireLock.mockResolvedValue(true);
    mockHandleWebhook.mockResolvedValue({
      success: true,
      transactionId: 'trx_123',
      orderId: 'order-456',
      rawResponse: { status: 'Completed' },
    });

    const controller = new WebhookController(paymentService);
    const result = await controller.handleBkashWebhook(
      Buffer.from(JSON.stringify({ paymentID: 'pay_success', status: 'Completed' })),
      'bkash-app-key',
    );

    expect(result.statusCode).toBe(200);
    expect(paymentService.handlePaymentSuccess).toHaveBeenCalledWith('trx_123', 'BKASH', {
      status: 'Completed',
    });
  });
});
