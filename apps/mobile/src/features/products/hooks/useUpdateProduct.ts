import type { UpdateProductInput } from '@lotea/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateProduct } from '../api';

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) => updateProduct(id, input),
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.setQueryData(['products', 'detail', product.id], product);
    },
  });
}
