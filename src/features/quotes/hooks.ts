import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addQuoteMaterialItem,
  addQuoteServiceItem,
  getQuoteDetail,
  getSuggestedMaterialPrice,
  listQuotes,
  upsertQuote,
} from '@/services/quotes';
import type { Quote, QuoteMaterialItem, QuoteServiceItem, QuoteStatus } from '@/types/db';

export const useQuotes = (status?: QuoteStatus | 'all') =>
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail', data.id] });
    },
  });
};

export const useAddQuoteMaterialItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<QuoteMaterialItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'item_name_snapshot' | 'total_price'>) =>
      addQuoteMaterialItem(payload),
    onSuccess: (line) => {
      queryClient.invalidateQueries({ queryKey: ['quote-detail', line.quote_id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
};

export const useAddQuoteServiceItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<QuoteServiceItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'service_name_snapshot' | 'total_price'>) =>
      addQuoteServiceItem(payload),
    onSuccess: (line) => {
      queryClient.invalidateQueries({ queryKey: ['quote-detail', line.quote_id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
};

export const useSuggestedMaterialPrice = (itemId: string, marginPercent?: number | null, sourceStoreId?: string | null) =>
  useQuery({
    queryKey: ['suggested-material-price', itemId, marginPercent ?? null, sourceStoreId ?? null],
    queryFn: () => getSuggestedMaterialPrice(itemId, marginPercent, sourceStoreId),
    enabled: Boolean(itemId),
  });
