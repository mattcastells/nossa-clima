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
        backgroundColor: '#EAF9EF',
        textColor: BRAND_GREEN,
        borderColor: '#B6E6C5',
      };
    case 'cancelled':
      return {
        backgroundColor: '#FEECEC',
        textColor: '#B91C1C',
        borderColor: '#FBD0D0',
      };
    default:
      return {
        backgroundColor: '#FEF6E7',
        textColor: '#B45309',
        borderColor: '#FADFA6',
      };
  }
};
