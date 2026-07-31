/**
 * Stable error codes shared by the API and the mobile client. The server never
 * hardcodes a human-facing sentence — it returns one of these codes, and the
 * client translates it to pt-BR copy through the i18n layer. See ARCHITECTURE.md §7.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** An InventoryItem was requested for a sale but isn't IN_STOCK (already sold, reserved, or written off). */
  INVENTORY_ITEM_UNAVAILABLE: 'INVENTORY_ITEM_UNAVAILABLE',
  /** Registration with an email that's already taken. */
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  /** Login with a wrong email/password pair. Deliberately the same code for "no such email" and "wrong password" — never reveal which one was wrong. */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** A refresh token that's missing, expired, revoked, or doesn't belong to this server's records. */
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  /** A Lot status change that isn't a legal transition (e.g. ARCHIVED → ACTIVE). */
  INVALID_LOT_STATUS_TRANSITION: 'INVALID_LOT_STATUS_TRANSITION',
  /** A purchase entry was attempted against a FINISHED or ARCHIVED lot. */
  LOT_NOT_ACTIVE: 'LOT_NOT_ACTIVE',
  /** Product creation blocked because similar catalog entries already exist — see `details` for the candidates. */
  DUPLICATE_PRODUCT_CANDIDATES: 'DUPLICATE_PRODUCT_CANDIDATES',
  /** A `catalogProductId` that doesn't exist or points to a deactivated (inactive) global catalog entry. */
  CATALOG_PRODUCT_NOT_FOUND: 'CATALOG_PRODUCT_NOT_FOUND',
  /** A sale would be created with an outstanding balance (receivedAmount < total) but no customerId. */
  CUSTOMER_REQUIRED: 'CUSTOMER_REQUIRED',
  /** A `customerId` that doesn't exist, is soft-deleted, or belongs to another tenant. */
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  /** A payment amount greater than the customer's current total outstanding balance. */
  PAYMENT_EXCEEDS_BALANCE: 'PAYMENT_EXCEEDS_BALANCE',
  /** A payment or received amount that's zero/negative, or a received amount greater than the sale's total. */
  INVALID_PAYMENT_AMOUNT: 'INVALID_PAYMENT_AMOUNT',
  /** Deleting (soft) a customer who still has an open balance. */
  CUSTOMER_HAS_OPEN_BALANCE: 'CUSTOMER_HAS_OPEN_BALANCE',
  /** Cancelling a sale that still has paidAmount > 0 — its payments must be voided (estornados) first. */
  SALE_HAS_ACTIVE_PAYMENTS: 'SALE_HAS_ACTIVE_PAYMENTS',
  /** A request was throttled by rate limiting. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** A manual stock write-off/adjustment requested more units than are currently IN_STOCK for the product. */
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    /** Developer-facing fallback text for logs/tooling — never shown to end users directly. */
    message: string;
    details?: unknown;
  };
}
