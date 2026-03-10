import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listItems, upsertItem } from '@/services/items';
import type { Item } from '@/types/db';

export const useItems = () => useQuery({ queryKey: ['items'], queryFn: listItems });

export const useSaveItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Item> & { name: string }) => upsertItem(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
};
