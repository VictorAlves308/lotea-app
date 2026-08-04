import { Prisma } from '../../generated/prisma/client';

/**
 * Retries a bounded number of times on Prisma's P2034 ("Transaction failed
 * due to a write conflict or a deadlock") — the uniform code Prisma surfaces
 * for a Postgres serialization failure or deadlock, regardless of driver.
 * Used for the payment registration/void transactions, which lock a
 * customer's open sales in a deterministic order — true deadlocks between
 * two such transactions are already structurally prevented by that
 * ordering, so this is defense-in-depth for the residual chance of a
 * Postgres serialization failure. See DATABASE.md, "Accounts receivable".
 */
export async function retrySerializationFailures<T>(
  run: () => Promise<T>,
  maxRetries = 2,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const isRetryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
      if (!isRetryable || attempt >= maxRetries) throw error;
    }
  }
}
