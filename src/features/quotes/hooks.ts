import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addQuoteMaterialItem,
  addQuoteServiceItem,
  deleteAllQuotes,
  deleteOldQuotes,
  deleteQuote,
  deleteQuoteMaterialItem,
  deleteQuoteServiceItem,
  getQuoteDetail,
  listQuotes,
  refreshQuoteMaterialPricing,
  type QuoteDetail,
  type QuoteListItem,
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
import { getMaterialEffectiveTotalPrice } from './materialPricing';
import { normalizeQuoteStatus } from './status';

type QuoteListFilter = JobQuoteStatus | 'all';

const roundCurrency = (value: number): number => Number(value.toFixed(2));

const invalidateQuoteCaches = (queryClient: ReturnType<typeof useQueryClient>, quoteId: string) => {
  void queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId], exact: true, refetchType: 'inactive' });
  void queryClient.invalidateQueries({ queryKey: ['quotes'], refetchType: 'inactive' });
};

const getQuoteListFilter = (queryKey: readonly unknown[]): QuoteListFilter => {
  const value = queryKey[1];
  return value === 'pending' || value === 'completed' || value === 'cancelled' || value === 'all' ? value : 'all';
};

const quoteMatchesFilter = (quote: Pick<Quote, 'status'>, filter: QuoteListFilter): boolean =>
  filter === 'all' || normalizeQuoteStatus(quote.status) === filter;

const getListAppointment = (detail: QuoteDetail | null | undefined): QuoteListItem['appointment'] =>
  detail?.appointment
    ? {
        scheduled_for: detail.appointment.scheduled_for,
        starts_at: detail.appointment.starts_at,
      }
    : null;

const updateQuoteListCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (quotes: QuoteListItem[], filter: QuoteListFilter) => QuoteListItem[],
) => {
  queryClient.getQueriesData<QuoteListItem[]>({ queryKey: ['quotes'] }).forEach(([queryKey, quotes]) => {
    if (!quotes) return;
    queryClient.setQueryData<QuoteListItem[]>(queryKey, updater(quotes, getQuoteListFilter(queryKey)));
  });
};

const upsertQuoteInListCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  quote: Quote,
  appointment: QuoteListItem['appointment'],
) => {
  updateQuoteListCaches(queryClient, (quotes, filter) => {
    const existingIndex = quotes.findIndex((item) => item.id === quote.id);
    const shouldInclude = quoteMatchesFilter(quote, filter);

    if (existingIndex === -1) {
      return shouldInclude ? [{ ...quote, appointment }, ...quotes] : quotes;
    }

    if (!shouldInclude) {
      return quotes.filter((item) => item.id !== quote.id);
    }

    return quotes.map((item, index) =>
      index === existingIndex
        ? {
            ...item,
            ...quote,
            appointment: appointment ?? item.appointment ?? null,
          }
        : item,
    );
  });
};

const removeQuoteFromListCaches = (queryClient: ReturnType<typeof useQueryClient>, quoteId: string) => {
  updateQuoteListCaches(queryClient, (quotes) => quotes.filter((item) => item.id !== quoteId));
};

const recalculateQuoteDetail = (detail: QuoteDetail): QuoteDetail => {
  const subtotalMaterials = roundCurrency(
    detail.materials.reduce(
      (sum, item) => sum + getMaterialEffectiveTotalPrice(item.quantity, item.unit_price, item.margin_percent, detail.quote.default_material_margin_percent),
      0,
    ),
  );
  const subtotalServices = roundCurrency(detail.services.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0));
  const total = roundCurrency(subtotalMaterials + subtotalServices);

  return {
    ...detail,
    quote: {
      ...detail.quote,
      subtotal_materials: subtotalMaterials,
      subtotal_services: subtotalServices,
      total,
    },
  };
};

const updateQuoteDetailCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  quoteId: string,
  updater: (detail: QuoteDetail) => QuoteDetail,
): QuoteDetail | null => {
  const current = queryClient.getQueryData<QuoteDetail>(['quote-detail', quoteId]);
  if (!current) return null;

  const next = recalculateQuoteDetail(updater(current));
  queryClient.setQueryData<QuoteDetail>(['quote-detail', quoteId], next);
  return next;
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
    onSuccess: (data) => {
      const nextDetail = updateQuoteDetailCache(queryClient, data.id, (detail) => ({
        ...detail,
        quote: {
          ...detail.quote,
          ...data,
        },
      }));
      upsertQuoteInListCaches(queryClient, nextDetail?.quote ?? data, getListAppointment(nextDetail));
      invalidateQuoteCaches(queryClient, data.id);
    },
  });
};

export const useUpdateQuoteStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, status }: { quoteId: string; status: JobQuoteStatus }) => updateQuoteStatus(quoteId, status),
    onSuccess: (data) => {
      const nextDetail = updateQuoteDetailCache(queryClient, data.id, (detail) => ({
        ...detail,
        quote: {
          ...detail.quote,
          ...data,
        },
      }));
      upsertQuoteInListCaches(queryClient, nextDetail?.quote ?? data, getListAppointment(nextDetail));
      invalidateQuoteCaches(queryClient, data.id);
    },
  });
};

export const useAddQuoteMaterialItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: QuoteMaterialItemInput) => addQuoteMaterialItem(payload),
    onSuccess: (line) => {
      const nextDetail = updateQuoteDetailCache(queryClient, line.quote_id, (detail) => ({
        ...detail,
        materials: [...detail.materials, line],
      }));
      if (nextDetail) {
        upsertQuoteInListCaches(queryClient, nextDetail.quote, getListAppointment(nextDetail));
      }
      invalidateQuoteCaches(queryClient, line.quote_id);
    },
  });
};

export const useUpdateQuoteMaterialItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: QuoteMaterialItemUpdate }) =>
      updateQuoteMaterialItem(itemId, payload),
    onSuccess: (line) => {
      const nextDetail = updateQuoteDetailCache(queryClient, line.quote_id, (detail) => ({
        ...detail,
        materials: detail.materials.map((item) => (item.id === line.id ? line : item)),
      }));
      if (nextDetail) {
        upsertQuoteInListCaches(queryClient, nextDetail.quote, getListAppointment(nextDetail));
      }
      invalidateQuoteCaches(queryClient, line.quote_id);
    },
  });
};

export const useDeleteQuoteMaterialItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteQuoteMaterialItem(itemId),
    onSuccess: (line, itemId) => {
      const nextDetail = updateQuoteDetailCache(queryClient, line.quote_id, (detail) => ({
        ...detail,
        materials: detail.materials.filter((item) => item.id !== itemId),
      }));
      if (nextDetail) {
        upsertQuoteInListCaches(queryClient, nextDetail.quote, getListAppointment(nextDetail));
      }
      invalidateQuoteCaches(queryClient, line.quote_id);
    },
  });
};

export const useRefreshQuoteMaterialPricing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => refreshQuoteMaterialPricing(quoteId),
    onSuccess: ({ quoteId }) => {
      const nextDetail = updateQuoteDetailCache(queryClient, quoteId, (detail) => detail);
      if (nextDetail) {
        upsertQuoteInListCaches(queryClient, nextDetail.quote, getListAppointment(nextDetail));
      }
      invalidateQuoteCaches(queryClient, quoteId);
    },
  });
};

export const useAddQuoteServiceItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: QuoteServiceItemInput) => addQuoteServiceItem(payload),
    onSuccess: (line) => {
      const nextDetail = updateQuoteDetailCache(queryClient, line.quote_id, (detail) => ({
        ...detail,
        services: [...detail.services, line],
      }));
      if (nextDetail) {
        upsertQuoteInListCaches(queryClient, nextDetail.quote, getListAppointment(nextDetail));
      }
      invalidateQuoteCaches(queryClient, line.quote_id);
    },
  });
};

export const useUpdateQuoteServiceItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: QuoteServiceItemUpdate }) => updateQuoteServiceItem(itemId, payload),
    onSuccess: (line) => {
      const nextDetail = updateQuoteDetailCache(queryClient, line.quote_id, (detail) => ({
        ...detail,
        services: detail.services.map((item) => (item.id === line.id ? line : item)),
      }));
      if (nextDetail) {
        upsertQuoteInListCaches(queryClient, nextDetail.quote, getListAppointment(nextDetail));
      }
      invalidateQuoteCaches(queryClient, line.quote_id);
    },
  });
};

export const useDeleteQuoteServiceItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteQuoteServiceItem(itemId),
    onSuccess: (line, itemId) => {
      const nextDetail = updateQuoteDetailCache(queryClient, line.quote_id, (detail) => ({
        ...detail,
        services: detail.services.filter((item) => item.id !== itemId),
      }));
      if (nextDetail) {
        upsertQuoteInListCaches(queryClient, nextDetail.quote, getListAppointment(nextDetail));
      }
      invalidateQuoteCaches(queryClient, line.quote_id);
    },
  });
};

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

export const useDeleteQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => deleteQuote(quoteId),
    onSuccess: (_, quoteId) => {
      queryClient.removeQueries({ queryKey: ['quote-detail', quoteId], exact: true });
      removeQuoteFromListCaches(queryClient, quoteId);
      void queryClient.invalidateQueries({ queryKey: ['quotes'], refetchType: 'inactive' });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};
