import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listStores, upsertStore } from '@/services/stores';
import type { Store } from '@/types/db';

export const useStores = () => useQuery({ queryKey: ['stores'], queryFn: listStores });

export const useSaveStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Store> & { name: string }) => upsertStore(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
};
