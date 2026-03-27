import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listItems, upsertItem } from '@/services/items';
import { listItemMeasurements, upsertItemMeasurement } from '@/services/itemMeasurements';
import type { Item, ItemMeasurement } from '@/types/db';

export const useItems = (includeArchivedIds: string[] = []) =>
  useQuery({
    queryKey: ['items', includeArchivedIds.slice().sort().join(',')],
    queryFn: () => listItems({ includeArchivedIds }),
  });

export const useSaveItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Item> & { name: string }) => upsertItem(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
};

export const useItemMeasurements = (itemId: string, includeArchivedIds: string[] = []) =>
  useQuery({
    queryKey: ['item-measurements', itemId, includeArchivedIds.slice().sort().join(',')],
    queryFn: () => listItemMeasurements(itemId, { includeArchivedIds }),
    enabled: Boolean(itemId),
  });

export const useSaveItemMeasurement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<ItemMeasurement> & Pick<ItemMeasurement, 'item_id' | 'label' | 'pricing_mode'>) => upsertItemMeasurement(payload),
    onSuccess: (measurement) => {
      queryClient.invalidateQueries({ queryKey: ['item-measurements', measurement.item_id] });
      queryClient.invalidateQueries({ queryKey: ['latest-measure-prices'] });
      queryClient.invalidateQueries({ queryKey: ['item-measure-price-history'] });
    },
  });
};
