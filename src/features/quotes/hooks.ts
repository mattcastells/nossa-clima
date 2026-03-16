import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addQuoteMaterialItem,
  addQuoteServiceItem,
  deleteAllQuotes,
  deleteOldQuotes,
  deleteQuoteMaterialItem,
  deleteQuoteServiceItem,
  duplicateQuoteMaterialItem,
  duplicateQuoteServiceItem,
  getQuoteDetail,
  getSuggestedMaterialPrice,
  listQuotes,
  refreshQuoteMaterialPricing,
  resetQuoteMaterialItemMarginsToDefault,
  type QuoteMaterialItemInput,
  type QuoteMaterialItemUpdate,
  type QuoteServiceItemInput,
  type QuoteServiceItemUpdate,
  updateQuoteStatus,
  updateQuoteMaterialItem,
  updateQuoteServiceItem,
  upsertQuote,
} from '@/services/quotes';
import type { JobQuoteStatus, Quote } from '@/types/db';

const invalidateQuoteCaches = (queryClient: ReturnType<typeof useQueryClient>, quoteId: string) => {
  queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId] });
  queryClient.invalidateQueries({ queryKey: ['quotes'] });
};

export const useQuotes = (status?: JobQuoteStatus | 'all') =>
  useQuery({ queryKey: ['quotes', status ?? 'all'], queryFn: () => listQuotes(status) });

export const useQuoteDetail = (quoteId: string) =>
  useQuery({
    queryKey: ['quote-detail', quoteId],
    queryFn: () => getQuoteDetail(quoteId),
    enabled: Boolean(quoteId),
  });

export const useSaveQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Quote> & Pick<Quote, 'client_name' | 'title'>) => upsertQuote(payload),
    onSuccess: (data) => invalidateQuoteCaches(queryClient, data.id),
  });
};

export const useUpdateQuoteStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, status }: { quoteId: string; status: JobQuoteStatus }) => updateQuoteStatus(quoteId, status),
    onSuccess: (data) => invalidateQuoteCaches(queryClient, data.id),
  });
};

export const useAddQuoteMaterialItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: QuoteMaterialItemInput) => addQuoteMaterialItem(payload),
    onSuccess: (line) => invalidateQuoteCaches(queryClient, line.quote_id),
  });
};

export const useUpdateQuoteMaterialItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: QuoteMaterialItemUpdate }) =>
      updateQuoteMaterialItem(itemId, payload),
    onSuccess: (line) => invalidateQuoteCaches(queryClient, line.quote_id),
  });
};

export const useDeleteQuoteMaterialItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteQuoteMaterialItem(itemId),
    onSuccess: (line) => invalidateQuoteCaches(queryClient, line.quote_id),
  });
};

export const useDuplicateQuoteMaterialItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => duplicateQuoteMaterialItem(itemId),
    onSuccess: (line) => invalidateQuoteCaches(queryClient, line.quote_id),
  });
};

export const useResetQuoteMaterialItemMarginsToDefault = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => resetQuoteMaterialItemMarginsToDefault(quoteId),
    onSuccess: ({ quoteId }) => invalidateQuoteCaches(queryClient, quoteId),
  });
};

export const useRefreshQuoteMaterialPricing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => refreshQuoteMaterialPricing(quoteId),
    onSuccess: ({ quoteId }) => invalidateQuoteCaches(queryClient, quoteId),
  });
};

export const useAddQuoteServiceItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: QuoteServiceItemInput) => addQuoteServiceItem(payload),
    onSuccess: (line) => invalidateQuoteCaches(queryClient, line.quote_id),
  });
};

export const useUpdateQuoteServiceItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: QuoteServiceItemUpdate }) => updateQuoteServiceItem(itemId, payload),
    onSuccess: (line) => invalidateQuoteCaches(queryClient, line.quote_id),
  });
};

export const useDeleteQuoteServiceItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteQuoteServiceItem(itemId),
    onSuccess: (line) => invalidateQuoteCaches(queryClient, line.quote_id),
  });
};

export const useDuplicateQuoteServiceItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => duplicateQuoteServiceItem(itemId),
    onSuccess: (line) => invalidateQuoteCaches(queryClient, line.quote_id),
  });
};

export const useSuggestedMaterialPrice = (itemId: string, marginPercent?: number | null, sourceStoreId?: string | null) =>
  useQuery({
    queryKey: ['suggested-material-price', itemId, marginPercent ?? null, sourceStoreId ?? null],
    queryFn: () => getSuggestedMaterialPrice(itemId, marginPercent, sourceStoreId),
    enabled: Boolean(itemId),
  });

export const useDeleteOldQuotes = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (olderThanDays: number) => deleteOldQuotes(olderThanDays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail'] });
    },
  });
};

export const useDeleteAllQuotes = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAllQuotes(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};
