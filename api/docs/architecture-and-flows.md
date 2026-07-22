# System Architecture and Payment Flows

This document captures the runtime architecture, domain data model, and payment integration flows for the E-commerce Ordering & Payment System.

## 1. System Architecture

The application is structured as a modular Express + TypeScript backend that serves a frontend client, persists data in PostgreSQL, uses Redis for caching and idempotency, and integrates with external payment gateways such as Stripe and bKash.

```mermaid
flowchart LR
    A[Client<br/>Vercel Frontend] --> B[Reverse Proxy / ngrok]
    B --> C[Express API Backend<br/>Node.js + TypeScript]
    C --> D[PostgreSQL Database<br/>Prisma ORM]
    C --> E[Redis Cache<br/>Cache + Idempotency]
    C --> F[Stripe API]
    C --> G[bKash API]
```

### Runtime Responsibilities

- Client: Sends user requests for authentication, products, orders, and payments.
- Reverse Proxy / ngrok: Exposes the API securely for local development or external callbacks.
- Express API Backend: Handles routing, validation, business rules, authentication, and webhook processing.
- PostgreSQL: Stores persistent business data such as users, products, categories, orders, order items, and payments.
- Redis: Supports transient cache behavior and webhook idempotency protection.
- External Services: Stripe and bKash process payment initiation, verification, and webhook notifications.

---

## 2. Domain Entity Relationship Model

The Prisma schema defines a relational model for users, products, categories, orders, order items, and payments.

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    CATEGORY ||--o{ PRODUCT : classifies
    CATEGORY ||--o{ CATEGORY : parent_child
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : included_in
    ORDER ||--|| PAYMENT : has

    USER {
        string id
        string email
        string passwordHash
        enum role
        datetime createdAt
        datetime updatedAt
    }

    CATEGORY {
        string id
        string name
        string slug
        string parentId
        datetime createdAt
        datetime updatedAt
    }

    PRODUCT {
        string id
        string name
        string sku
        string description
        decimal price
        int stock
        enum status
        string categoryId
        datetime createdAt
        datetime updatedAt
    }

    ORDER {
        string id
        string userId
        decimal totalAmount
        enum status
        datetime createdAt
        datetime updatedAt
    }

    ORDER_ITEM {
        string id
        string orderId
        string productId
        int quantity
        decimal price
        decimal subtotal
    }

    PAYMENT {
        string id
        string orderId
        enum provider
        string transactionId
        enum status
        json rawResponse
        datetime createdAt
        datetime updatedAt
    }
```

### Relationship Summary

- One user can place many orders.
- One category can contain many products, and categories can be nested.
- One order contains many order items.
- Each order item references one product.
- Each order has exactly one payment record.

---

## 3. Stripe Payment Flow

This flow covers payment intent creation on the backend, redirect/checkout completion on the frontend, and webhook execution for fulfillment.

```mermaid
sequenceDiagram
    participant Frontend as Vercel Frontend
    participant API as Express API
    participant DB as PostgreSQL
    participant Stripe as Stripe
    participant Webhook as Webhook Controller

    Frontend->>API: POST /api/payments/initiate<br/>(orderId, provider=STRIPE)
    API->>DB: Create payment record as PENDING
    API->>Stripe: Create PaymentIntent / Checkout Session
    Stripe-->>API: paymentIntentId + client_secret
    API-->>Frontend: Return paymentUrl / client secret
    Frontend->>Stripe: Complete checkout
    Stripe-->>Webhook: payment_intent.succeeded or payment_intent.payment_failed
    Webhook->>API: Verify Stripe signature and process event
    API->>DB: Mark payment successful, update order, reduce stock
```

### Stripe Notes

- The backend validates the webhook signature before acting on any event.
- Events are idempotently processed to prevent duplicate stock updates.
- Successful payment events trigger post-payment fulfillment logic.

---

## 4. bKash Payment Flow

This flow shows the bKash merchant checkout lifecycle from token generation through callback-based confirmation.

```mermaid
sequenceDiagram
    participant Frontend as Vercel Frontend
    participant API as Express API
    participant BKash as bKash API
    participant DB as PostgreSQL
    participant Webhook as Webhook Controller

    Frontend->>API: POST /api/payments/initiate<br/>(orderId, provider=BKASH)
    API->>BKash: POST /token/grant<br/>(app key + app secret)
    BKash-->>API: id_token
    API->>BKash: POST /create<br/>(amount, callbackURL, payerReference)
    BKash-->>API: paymentID + bkashURL
    API-->>Frontend: Return payment URL
    Frontend->>BKash: Complete checkout using PIN / OTP
    BKash-->>API: Execute / callback notification
    API->>BKash: POST /execute or /query
    BKash-->>API: trxID + transaction status
    API->>DB: Persist payment result and update order state
    BKash-->>Webhook: Callback webhook event
    Webhook->>API: Validate app key and process event
    API->>DB: Finalize payment and stock reduction
```

### bKash Notes

- The backend first requests a token before payment creation.
- The user completes the payment in the gateway UI.
- Webhook delivery and app-key validation are used to finalize the transaction safely.

---

## 5. Operational Considerations

- Use HTTPS for all public-facing endpoints and callback URLs.
- Protect webhook endpoints with signature or shared-key validation.
- Store payment state transitions immutably and deduplicate webhook events.
- Use Redis for short-lived locking and replay protection.
- Keep database transactions atomic when updating payments, orders, and inventory.
