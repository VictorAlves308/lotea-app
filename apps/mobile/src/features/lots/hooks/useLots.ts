import type { CreateLotInput, RegisterEntryInput } from '@lotea/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createLot, createPurchaseEntry } from '../api';

/**
 * Minimal mutation pair used today by Produtos' "estoque inicial" flow
 * (create an implicit lot, then register one purchase entry against it) —
 * the full Lotes feature (list, detail, "Novo lote" with multiple product
 * lines) builds on these same two calls later.
 */
export function useLots() {
  const queryClient = useQueryClient();

  const createLotMutation = useMutation({
    mutationFn: (input: CreateLotInput) => createLot(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lots'] });
    },
  });

  const createPurchaseEntryMutation = useMutation({
    mutationFn: ({ lotId, input }: { lotId: string; input: Omit<RegisterEntryInput, 'lotId'> }) =>
      createPurchaseEntry(lotId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      // A purchase entry changes the lot's item count/financials too — without
      // this, the Lotes list/detail screens keep showing whatever snapshot
      // they'd already cached before this entry existed (e.g. "0 unidades"
      // right after creating a lot and adding its first products).
      void queryClient.invalidateQueries({ queryKey: ['lots'] });
    },
  });

  return { createLot: createLotMutation, createPurchaseEntry: createPurchaseEntryMutation };
}
