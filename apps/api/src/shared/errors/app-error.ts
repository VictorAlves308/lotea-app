import type { ErrorCode } from '@lotea/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super('NOT_FOUND', message, 404, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super('UNAUTHORIZED', message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super('FORBIDDEN', message, 403, details);
  }
}

export class InventoryItemUnavailableError extends AppError {
  constructor(inventoryItemId: string, details?: unknown) {
    super(
      'INVENTORY_ITEM_UNAVAILABLE',
      `Inventory item ${inventoryItemId} is not available for sale.`,
      409,
      details,
    );
  }
}

export class EmailAlreadyRegisteredError extends AppError {
  constructor() {
    super('EMAIL_ALREADY_REGISTERED', 'This email is already registered.', 409);
  }
}

/** Deliberately the same error for "no such email" and "wrong password" — never reveal which one was wrong. */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
  }
}

export class InvalidRefreshTokenError extends AppError {
  constructor() {
    super('INVALID_REFRESH_TOKEN', 'Refresh token is missing, expired, or revoked.', 401);
  }
}

export class InvalidLotStatusTransitionError extends AppError {
  constructor(from: string, to: string) {
    super('INVALID_LOT_STATUS_TRANSITION', `Cannot transition a lot from ${from} to ${to}.`, 409);
  }
}

export class LotNotActiveError extends AppError {
  constructor(status: string) {
    super('LOT_NOT_ACTIVE', `Cannot add inventory to a lot with status ${status}.`, 409);
  }
}

export class DuplicateProductCandidatesError extends AppError {
  constructor(candidates: unknown) {
    super(
      'DUPLICATE_PRODUCT_CANDIDATES',
      'Similar products already exist — confirm to create a new one anyway.',
      409,
      { candidates },
    );
  }
}

export class CatalogProductNotFoundError extends AppError {
  constructor() {
    super(
      'CATALOG_PRODUCT_NOT_FOUND',
      'Catalog product not found or no longer active.',
      404,
    );
  }
}

/** A sale would be created with an outstanding balance (receivedAmount < total) but no customerId. */
export class CustomerRequiredError extends AppError {
  constructor() {
    super(
      'CUSTOMER_REQUIRED',
      'A customer is required whenever a sale is not received in full.',
      422,
    );
  }
}

export class CustomerNotFoundError extends AppError {
  constructor(message = 'Customer not found', details?: unknown) {
    super('CUSTOMER_NOT_FOUND', message, 404, details);
  }
}

export class PaymentExceedsBalanceError extends AppError {
  constructor() {
    super(
      'PAYMENT_EXCEEDS_BALANCE',
      "Payment amount exceeds the customer's current outstanding balance.",
      422,
    );
  }
}

/** A payment/received amount that's zero/negative, or a received amount greater than the sale's total. */
export class InvalidPaymentAmountError extends AppError {
  constructor(message = 'Invalid payment amount.') {
    super('INVALID_PAYMENT_AMOUNT', message, 422);
  }
}

export class CustomerHasOpenBalanceError extends AppError {
  constructor() {
    super(
      'CUSTOMER_HAS_OPEN_BALANCE',
      'Cannot remove a customer who still has an open balance.',
      409,
    );
  }
}

/**
 * Cancelling a sale that still has paidAmount > 0 — its payments must be
 * voided (estornados) first. `message` is the usual developer-facing
 * fallback (never shown to end users directly); the client's i18n layer
 * renders this code as "Esta venda possui pagamentos registrados. Estorne
 * os pagamentos antes de cancelar a venda." per DATABASE.md.
 */
export class SaleHasActivePaymentsError extends AppError {
  constructor() {
    super(
      'SALE_HAS_ACTIVE_PAYMENTS',
      'Cannot cancel a sale with an active payment — void its payments first.',
      409,
    );
  }
}

export class InsufficientStockError extends AppError {
  constructor(productId: string, available: number, requested: number) {
    super(
      'INSUFFICIENT_STOCK',
      `Product ${productId} has only ${available} unit(s) in stock — requested ${requested}.`,
      409,
      { productId, available, requested },
    );
  }
}
