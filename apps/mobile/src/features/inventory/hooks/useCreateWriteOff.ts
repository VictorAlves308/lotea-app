import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createWriteOff } from '../api';

export function useCreateWriteOff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWriteOff,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
