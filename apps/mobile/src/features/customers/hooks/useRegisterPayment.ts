import type { RegisterPaymentInput } from '@lotea/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { registerPayment } from '../api';

export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, input }: { customerId: string; input: RegisterPaymentInput }) =>
      registerPayment(customerId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
