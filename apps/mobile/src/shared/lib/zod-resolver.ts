import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * A minimal `react-hook-form` resolver backed directly by a zod schema's
 * `safeParse` — used instead of `@hookform/resolvers/zod`, whose published
 * types don't match the zod version installed here (a real, pre-existing
 * monorepo version-pinning mismatch: `packages/shared` pins `zod@^4.1.10`,
 * but `@hookform/resolvers@5.4.0`'s `zodResolver` type-checks against an
 * exact zod 4.0.x internal shape and rejects 4.4.x with a `_zod.version.minor`
 * mismatch). Worth revisiting — pin zod to a version both packages agree on
 * — but out of scope for this screen; this sidesteps it cleanly. The form
 * values type is passed explicitly (`zodResolver<LoginInput>(schema)`) rather
 * than inferred from the schema, to avoid a conditional-type mismatch with
 * react-hook-form's own `Resolver<T>` shape.
 */
export function zodResolver<TFieldValues extends FieldValues>(
  schema: z.ZodTypeAny,
): Resolver<TFieldValues> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data as TFieldValues, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      if (!errors[path]) {
        errors[path] = { type: issue.code, message: issue.message };
      }
    }
    return { values: {}, errors: errors as FieldErrors<TFieldValues> };
  };
}
