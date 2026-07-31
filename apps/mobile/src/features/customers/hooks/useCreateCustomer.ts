import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createCustomer } from '../api';

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: (result) => {
      if (result.status === 'created') {
        void queryClient.invalidateQueries({ queryKey: ['customers', 'list'] });
      }
    },
  });
}
