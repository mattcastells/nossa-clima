import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createMeasurePriceRecord,
  createPriceRecord,
  listItemHistory,
  listItemMeasureHistory,
  listLatestManualMeasurePrices,
  listLatestMeasurePrices,
  listLatestPrices,
} from '@/services/prices';
import type { StoreItemMeasurementPrice, StoreItemPrice } from '@/types/db';

export const useLatestPrices = () => useQuery({ queryKey: ['latest-prices'], queryFn: listLatestPrices });

export const useLatestMeasurePrices = (options: { itemId?: string; storeId?: string } = {}) =>
  useQuery({
    queryKey: ['latest-measure-prices', options.itemId ?? null, options.storeId ?? null],
    queryFn: () => listLatestMeasurePrices(options),
  });

export const useLatestManualMeasurePrices = (options: { itemId?: string; storeId?: string } = {}) =>
  useQuery({
    queryKey: ['latest-manual-measure-prices', options.itemId ?? null, options.storeId ?? null],
    queryFn: () => listLatestManualMeasurePrices(options),
  });

export const useItemPriceHistory = (itemId: string) =>
  useQuery({
    queryKey: ['item-price-history', itemId],
    queryFn: () => listItemHistory(itemId),
    enabled: Boolean(itemId),
  });

export const useItemMeasurePriceHistory = (itemId: string) =>
  useQuery({
    queryKey: ['item-measure-price-history', itemId],
    queryFn: () => listItemMeasureHistory(itemId),
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
      queryClient.invalidateQueries({ queryKey: ['latest-measure-prices'] });
      queryClient.invalidateQueries({ queryKey: ['item-measure-price-history'] });
      queryClient.invalidateQueries({ queryKey: ['store-latest-prices'] });
    },
  });
};

export const useCreateMeasurePrice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<StoreItemMeasurementPrice, 'id' | 'created_at' | 'user_id'>) => createMeasurePriceRecord(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['latest-measure-prices'] });
      queryClient.invalidateQueries({ queryKey: ['latest-manual-measure-prices'] });
      queryClient.invalidateQueries({ queryKey: ['item-measure-price-history'] });
      queryClient.invalidateQueries({ queryKey: ['store-latest-prices'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail'] });
    },
  });
};
