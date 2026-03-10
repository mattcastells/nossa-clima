import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createPriceRecord, listItemHistory, listLatestPrices } from '@/services/prices';
import type { StoreItemPrice } from '@/types/db';

export const useLatestPrices = () => useQuery({ queryKey: ['latest-prices'], queryFn: listLatestPrices });

export const useItemPriceHistory = (itemId: string) =>
  useQuery({
    queryKey: ['item-price-history', itemId],
    queryFn: () => listItemHistory(itemId),
    enabled: Boolean(itemId),
  });

export const useCreatePrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<StoreItemPrice, 'id' | 'created_at' | 'user_id'>) =>
      createPriceRecord(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['latest-prices'] });
      queryClient.invalidateQueries({ queryKey: ['item-price-history'] });
    },
  });
};
