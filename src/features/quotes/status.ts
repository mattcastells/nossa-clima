import { BRAND_GREEN } from '@/theme';
import type { JobQuoteStatus, QuoteStatus } from '@/types/db';

export const normalizeQuoteStatus = (status: QuoteStatus | null | undefined): JobQuoteStatus => {
  switch (status) {
    case 'completed':
    case 'approved':
      return 'completed';
    case 'cancelled':
    case 'rejected':
      return 'cancelled';
    default:
      return 'pending';
  }
};

export const quoteStatusLabel = (status: QuoteStatus | null | undefined): string => {
  switch (normalizeQuoteStatus(status)) {
    case 'completed':
      return 'Terminado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Pendiente';
  }
};

export const quoteStatusAccent = (status: QuoteStatus | null | undefined): {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
} => {
  switch (normalizeQuoteStatus(status)) {
    case 'completed':
      return {
        backgroundColor: '#E8F3E3',
        textColor: BRAND_GREEN,
        borderColor: '#C8DCBC',
      };
    case 'cancelled':
      return {
        backgroundColor: '#F8E4E4',
        textColor: '#A13838',
        borderColor: '#E7C1C1',
      };
    default:
      return {
        backgroundColor: '#FFF4D9',
        textColor: '#8D6B12',
        borderColor: '#E8D7A2',
      };
  }
};
