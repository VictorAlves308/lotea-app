import { Prisma } from '../../generated/prisma/client';

/**
 * Checks whether an error is a Postgres unique-violation (Prisma P2002) on a
 * specific constraint/index. The exact shape of `error.meta` differs between
 * a plain `@@unique` (column names in `meta.target`) and a hand-added
 * raw-SQL index like `SaleItem_active_inventoryItemId_key` (whose name shows
 * up nested under `meta.driverAdapterError.cause` instead, when using the
 * `@prisma/adapter-pg` driver adapter) — rather than depend on either exact
 * shape, this searches the whole serialized `meta` object for the
 * constraint name or column name.
 */
export function isUniqueConstraintViolation(
  error: unknown,
  constraintNameOrColumn: string,
): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  return JSON.stringify(error.meta ?? {}).includes(constraintNameOrColumn);
}
