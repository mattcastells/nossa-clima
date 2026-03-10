import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listServices, upsertService } from '@/services/services';
import type { Service } from '@/types/db';

export const useServices = () => useQuery({ queryKey: ['services'], queryFn: listServices });

export const useSaveService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Service> & { name: string }) => upsertService(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
};
