import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { archiveItems, listItems, listItemsWithStats, upsertItem } from '@/services/items';
import { listItemMeasurements, upsertItemMeasurement } from '@/services/itemMeasurements';
import type { Item, ItemMeasurement } from '@/types/db';

export const useItems = (includeArchivedIds: string[] = []) =>
  useQuery({
    queryKey: ['items', includeArchivedIds.slice().sort().join(',')],
    queryFn: () => listItems({ includeArchivedIds }),
  });

/** Materials list with the measurement/store counters shown on each card. */
export const useItemsWithStats = (includeArchivedIds: string[] = []) =>
  useQuery({
    queryKey: ['items-with-stats', includeArchivedIds.slice().sort().join(',')],
    queryFn: () => listItemsWithStats({ includeArchivedIds }),
  });

export const useSaveItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Item> & { name: string }) => upsertItem(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
};

/** Archiva uno o varios materiales. Ver archiveItems: es borrado logico. */
export const useArchiveItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: string[]) => archiveItems(itemIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['items-with-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['latest-prices'] });
      void queryClient.invalidateQueries({ queryKey: ['latest-measure-prices'] });
    },
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
