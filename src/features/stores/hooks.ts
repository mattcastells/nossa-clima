import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { archiveStore, listStores, upsertStore } from '@/services/stores';
import type { Store } from '@/types/db';

export const useStores = (includeArchivedIds: string[] = []) =>
  useQuery({
    queryKey: ['stores', includeArchivedIds.slice().sort().join(',')],
    queryFn: () => listStores({ includeArchivedIds }),
  });

export const useSaveStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Store> & { name: string }) => upsertStore(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stores'] }),
  });
};

export const useArchiveStore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (storeId: string) => archiveStore(storeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-latest-prices'] });
      queryClient.invalidateQueries({ queryKey: ['latest-prices'] });
    },
  });
};
