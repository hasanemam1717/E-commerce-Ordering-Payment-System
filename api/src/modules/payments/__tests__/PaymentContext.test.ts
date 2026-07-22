/**
 * PaymentContext tests — verifies correct strategy dispatching
 * for Stripe, bKash, and unsupported providers.
 *
 * Tests overwrite the STRATEGY_REGISTRY directly with mock strategies
 * to avoid instantiating real Stripe/bKash SDK objects.
 */

// Must mock Stripe before any imports to prevent constructor validation error
jest.mock('stripe', () => {
  return jest.fn().mockImplementation((apiKey?: string) => {
    if (!apiKey || apiKey === 'sk_test_placeholder') {
      throw new Error('Neither apiKey nor config.authenticator provided');
    }

    return {
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      webhooks: { constructEvent: jest.fn() },
    };
  });
});

import { PaymentContext, STRATEGY_REGISTRY } from '../payment.context';
import { UnsupportedProviderError } from '../payment.errors';
import { StripePaymentStrategy } from '../stripe.strategy';

// ─── Helpers ───────────────────────────────────────────────
const mockInitiatePayment = jest.fn();
const mockVerifyPayment = jest.fn();
const mockHandleWebhook = jest.fn();

const mockStrategy = {
  initiatePayment: mockInitiatePayment,
  verifyPayment: mockVerifyPayment,
  handleWebhook: mockHandleWebhook,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Replace the strategy registry with mock implementations
  STRATEGY_REGISTRY.STRIPE = mockStrategy;
  STRATEGY_REGISTRY.BKASH = mockStrategy;
});

afterAll(() => {
  // Clean up — avoid side effects on other test suites
  delete STRATEGY_REGISTRY.STRIPE;
  delete STRATEGY_REGISTRY.BKASH;
});

// ════════════════════════════════════════════════════════════
//  Strategy Resolution
// ════════════════════════════════════════════════════════════

describe('PaymentContext — Strategy Resolution', () => {
  it('does not construct Stripe until a Stripe payment is actually initiated', async () => {
    const strategy = new StripePaymentStrategy();

    expect(strategy).toBeDefined();
  });

  it('dispatches initiatePayment to Stripe strategy when provider is STRIPE', async () => {
    mockInitiatePayment.mockResolvedValue({
      paymentUrl: '',
      transactionId: 'pi_test_123',
      metadata: { client_secret: 'secret_abc' },
    });

    const result = await PaymentContext.initiatePayment('STRIPE', 'order-1', 99.99);

    expect(mockInitiatePayment).toHaveBeenCalledWith('order-1', 99.99, undefined);
    expect(result.transactionId).toBe('pi_test_123');
  });

  it('dispatches initiatePayment to bKash strategy when provider is BKASH', async () => {
    mockInitiatePayment.mockResolvedValue({
      paymentUrl: 'https://bkash.example.com/pay',
      transactionId: 'BKASH001',
    });

    const result = await PaymentContext.initiatePayment('BKASH', 'order-2', 50.0);

    expect(mockInitiatePayment).toHaveBeenCalledWith('order-2', 50.0, undefined);
    expect(result.paymentUrl).toBe('https://bkash.example.com/pay');
  });

  it('dispatches verifyPayment to the correct strategy', async () => {
    mockVerifyPayment.mockResolvedValue({
      success: true,
      transactionId: 'pi_verify_123',
      rawResponse: { status: 'succeeded' },
    });

    const result = await PaymentContext.verifyPayment('STRIPE', {
      transactionId: 'pi_verify_123',
    });

    expect(mockVerifyPayment).toHaveBeenCalledWith({ transactionId: 'pi_verify_123' });
    expect(result.success).toBe(true);
  });

  it('dispatches handleWebhook to the correct strategy', async () => {
    mockHandleWebhook.mockResolvedValue({
      eventType: 'payment_intent.succeeded',
      transactionId: 'pi_webhook_123',
      orderId: 'order-1',
      success: true,
      rawResponse: { id: 'evt_123' },
    });

    const result = await PaymentContext.handleWebhook(
      'STRIPE',
      { 'stripe-signature': 'sig_abc' },
      Buffer.from('{}'),
    );

    expect(mockHandleWebhook).toHaveBeenCalledWith(
      { 'stripe-signature': 'sig_abc' },
      Buffer.from('{}'),
    );
    expect(result.success).toBe(true);
  });

  it('passes metadata through to initiatePayment', async () => {
    mockInitiatePayment.mockResolvedValue({
      paymentUrl: '',
      transactionId: 'pi_meta_123',
    });

    const metadata = { order_id: 'order-99', customer_email: 'test@example.com' };
    await PaymentContext.initiatePayment('STRIPE', 'order-99', 100, metadata);

    expect(mockInitiatePayment).toHaveBeenCalledWith('order-99', 100, metadata);
  });
});

// ════════════════════════════════════════════════════════════
//  Unsupported Provider
// ════════════════════════════════════════════════════════════

describe('PaymentContext — Unsupported Provider', () => {
  it('throws UnsupportedProviderError for an unknown provider on initiatePayment', async () => {
    await expect(PaymentContext.initiatePayment('PAYPAL' as any, 'order-1', 10)).rejects.toThrow(
      UnsupportedProviderError,
    );
  });

  it('throws UnsupportedProviderError for an unknown provider on verifyPayment', async () => {
    await expect(
      PaymentContext.verifyPayment('PAYPAL' as any, { transactionId: 'txn_1' }),
    ).rejects.toThrow(UnsupportedProviderError);
  });

  it('throws UnsupportedProviderError for an unknown provider on handleWebhook', async () => {
    await expect(
      PaymentContext.handleWebhook('PAYPAL' as any, {}, Buffer.from('{}')),
    ).rejects.toThrow(UnsupportedProviderError);
  });
});

// ════════════════════════════════════════════════════════════
//  Error Propagation
// ════════════════════════════════════════════════════════════

describe('PaymentContext — Error Propagation', () => {
  it('propagates errors thrown by the strategy implementation', async () => {
    const apiError = new Error('Stripe API timeout');
    mockInitiatePayment.mockRejectedValue(apiError);

    await expect(PaymentContext.initiatePayment('STRIPE', 'order-err', 10)).rejects.toThrow(
      'Stripe API timeout',
    );
  });
});
