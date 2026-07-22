/**
 * BkashPaymentStrategy — Concrete implementation of IPaymentStrategy
 * for the bKash Merchant Checkout API (Grant Token flow).
 *
 * Flow:
 *   1. GET /tokenized/v2/token/grant  →  id_token
 *   2. POST /tokenized/v2/create      →  paymentID, bkashURL
 *   3. (client redirects to bkashURL, completes on bKash)
 *   4. POST /tokenized/v2/execute     →  trxID, status
 *   5. (optional) GET /tokenized/v2/query  →  status check
 */
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { BkashTokenError, BkashApiError } from './payment.errors';
import type { IPaymentStrategy } from './payment.strategy';
import type {
  InitiatePaymentResult,
  VerifyPaymentPayload,
  VerifyPaymentResult,
  WebhookResult,
} from './payment.types';

interface BkashTokenResponse {
  id_token: string;
  token_type?: string;
  expires_in?: number;
}

interface BkashCreateResponse {
  paymentID: string;
  bkashURL: string;
  status: string;
}

interface BkashExecuteResponse {
  paymentID: string;
  trxID: string;
  transactionStatus: string;
  amount: string;
}

interface BkashQueryResponse {
  transactionStatus: string;
  trxID: string;
}

export class BkashPaymentStrategy implements IPaymentStrategy {
  private readonly baseUrl: string;
  private readonly appKey: string;
  private readonly appSecret: string;

  constructor() {
    this.baseUrl = env.BKASH_BASE_URL ?? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';
    this.appKey = env.BKASH_APP_KEY ?? '';
    this.appSecret = env.BKASH_APP_SECRET ?? '';

    if (!this.appKey || !this.appSecret) {
      logger.warn('BKASH_APP_KEY or BKASH_APP_SECRET not set — bKash strategy will fail at runtime');
    }
  }

  // ─── Token Grant ────────────────────────────────────────
  private async grantToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/tokenized/v2/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-key': this.appKey,
      },
      body: JSON.stringify({
        app_key: this.appKey,
        app_secret: this.appSecret,
      }),
    });

    if (!response.ok) {
      throw new BkashTokenError(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as BkashTokenResponse;

    if (!data.id_token) {
      throw new BkashTokenError('No id_token in response');
    }

    logger.debug('bKash token granted');
    return data.id_token;
  }

  // ─── Initiate Payment ───────────────────────────────────
  async initiatePayment(
    orderId: string,
    amount: number,
    metadata?: Record<string, string>,
  ): Promise<InitiatePaymentResult> {
    const token = await this.grantToken();
    const callbackUrl = metadata?.['callbackUrl'] ?? 'https://example.com/bkash/callback';
    const amountStr = amount.toFixed(2);

    const response = await fetch(`${this.baseUrl}/tokenized/v2/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'x-app-key': this.appKey,
      },
      body: JSON.stringify({
        mode: '0011',
        payerReference: orderId,
        callbackURL: callbackUrl,
        amount: amountStr,
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: `INV-${orderId.slice(0, 8)}`,
      }),
    });

    if (!response.ok) {
      throw new BkashApiError(`Create payment HTTP ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as BkashCreateResponse;

    if (!data.bkashURL) {
      throw new BkashApiError(`No bkashURL in create response: ${JSON.stringify(data)}`);
    }

    logger.info(
      { orderId, paymentID: data.paymentID },
      'bKash payment created',
    );

    return {
      paymentUrl: data.bkashURL,
      transactionId: data.paymentID,
    };
  }

  // ─── Verify Payment (Execute + Query) ───────────────────
  async verifyPayment(payload: VerifyPaymentPayload): Promise<VerifyPaymentResult> {
    const token = await this.grantToken();
    const { transactionId } = payload;

    // Execute the payment (completes the bKash checkout)
    const executeResponse = await fetch(`${this.baseUrl}/tokenized/v2/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'x-app-key': this.appKey,
      },
      body: JSON.stringify({
        paymentID: transactionId,
      }),
    });

    if (!executeResponse.ok) {
      throw new BkashApiError(
        `Execute payment HTTP ${executeResponse.status}: ${await executeResponse.text()}`,
      );
    }

    const executeData = (await executeResponse.json()) as BkashExecuteResponse;
    const succeeded = executeData.transactionStatus === 'Completed';

    // Query for additional confirmation
    const queryResponse = await fetch(`${this.baseUrl}/tokenized/v2/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'x-app-key': this.appKey,
      },
      body: JSON.stringify({
        paymentID: transactionId,
      }),
    });

    const queryData = queryResponse.ok
      ? ((await queryResponse.json()) as BkashQueryResponse)
      : null;

    logger.info(
      { transactionId, status: executeData.transactionStatus, trxID: executeData.trxID },
      'bKash payment verified',
    );

    return {
      success: succeeded,
      transactionId: executeData.trxID || transactionId,
      rawResponse: {
        execute: executeData,
        query: queryData,
      } as unknown as Record<string, unknown>,
    };
  }

  // ─── Handle Webhook ─────────────────────────────────────
  async handleWebhook(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookResult> {
    // bKash sends webhook notifications on their callback URL.
    // The body typically contains paymentID, trxID, status, etc.
    const body = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;

    const paymentID = (body['paymentID'] as string) ?? '';
    const trxID = (body['trxID'] as string) ?? '';
    const status = (body['status'] as string) ?? (body['transactionStatus'] as string) ?? '';
    const merchantInvoiceNumber = (body['merchantInvoiceNumber'] as string) ?? '';
    const succeeded = status === 'Completed' || status === 'success';

    // Extract orderId from payerReference or merchantInvoiceNumber
    const payerReference = (body['payerReference'] as string) ?? '';
    const orderId = merchantInvoiceNumber.replace('INV-', '') || payerReference;

    logger.info(
      { paymentID, trxID, status, orderId },
      'bKash webhook received',
    );

    return {
      eventType: status,
      transactionId: trxID || paymentID,
      orderId,
      success: succeeded,
      rawResponse: body as Record<string, unknown>,
    };
  }
}
