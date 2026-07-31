import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createProduct } from '../api';

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    onSuccess: (result) => {
      if (result.status === 'created') {
        void queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    },
  });
}
