import { useState } from 'react';

import { router } from 'expo-router';
import type { QueryClient } from '@tanstack/react-query';

import { useAppToast } from '@/components/AppToastProvider';
import { useLinkAppointmentToQuote, useUpsertQuoteAppointment } from '@/features/appointments/hooks';
import type { QuoteFormValues } from '@/features/quotes/schemas';
import { formatDateAr, formatTimeShort } from '@/lib/format';
import { normalizeDateInput, normalizeOptionalTimeInput } from '@/lib/dateTimeInput';
import { toUserErrorMessage } from '@/lib/errors';
import {
  addQuoteMaterialItem,
  addQuoteServiceItem,
  deleteQuote as deleteQuoteById,
  upsertQuote,
} from '@/services/quotes';

import type { DraftMaterialLine, DraftServiceLine } from './types';

interface UseQuoteSaveWorkflowOptions {
  draftServices: DraftServiceLine[];
  draftMaterials: DraftMaterialLine[];
  scheduleDate: string;
  scheduleTime: string;
  hasLinkedAppointment: boolean;
  appointmentId: string;
  queryClient: QueryClient;
  onError: (msg: string) => void;
}

export function useQuoteSaveWorkflow({
  draftServices,
  draftMaterials,
  scheduleDate,
  scheduleTime,
  hasLinkedAppointment,
  appointmentId,
  queryClient,
  onError,
}: UseQuoteSaveWorkflowOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const toast = useAppToast();
  const linkAppointment = useLinkAppointmentToQuote();
  const scheduleQuote = useUpsertQuoteAppointment();

  const safeNavigateToQuote = (id: string | null | undefined, opts?: { warning?: string }) => {
    if (!id || !String(id).trim()) {
      onError('Trabajo creado pero no se pudo abrir el detalle.');
      return;
    }
    try {
      if (opts?.warning) {
        router.replace({ pathname: '/quotes/[id]', params: { id, warning: opts.warning } });
      } else {
        router.replace(`/quotes/${id}`);
      }
    } catch {
      onError('Trabajo creado pero falló la navegación al detalle.');
    }
  };

  const handleSubmit = async (values: QuoteFormValues) => {
    let quoteId: string | null = null;
    try {
      setIsSaving(true);

      if (!hasLinkedAppointment && scheduleTime.trim() && !scheduleDate.trim()) {
        throw new Error('Ingresa una fecha antes de cargar una hora.');
      }

      const normalizedDate =
        !hasLinkedAppointment && scheduleDate.trim() ? normalizeDateInput(scheduleDate) : null;
      const normalizedTime = !hasLinkedAppointment ? normalizeOptionalTimeInput(scheduleTime) : null;

      const quote = await upsertQuote({
        title: values.title,
        client_name: values.client_name,
        client_phone: values.client_phone?.trim() ? values.client_phone.trim() : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
        status: 'pending',
      });
      quoteId = quote.id;

      for (const service of draftServices) {
        await addQuoteServiceItem({
          quote_id: quote.id,
          service_id: service.service_id,
          quantity: service.quantity,
          unit_price: service.unit_price,
          margin_percent: null,
          notes: service.notes,
        });
      }

      for (const material of draftMaterials) {
        await addQuoteMaterialItem({
          quote_id: quote.id,
          item_id: material.item_id,
          item_measurement_id: material.item_measurement_id,
          quantity: material.quantity,
          unit: material.unit,
          unit_price: material.unit_price,
          margin_percent: null,
          source_store_id: material.source_store_id,
          notes: material.notes,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['quotes'] }),
        queryClient.invalidateQueries({ queryKey: ['quote-detail', quote.id] }),
      ]);

      if (hasLinkedAppointment) {
        try {
          await linkAppointment.mutateAsync({
            appointmentId,
            quoteId: quote.id,
            title: values.title.trim(),
            notes: values.notes?.trim() ? values.notes.trim() : null,
          });
          toast.success('Trabajo creado y vinculado.');
          safeNavigateToQuote(quote.id);
          return;
        } catch {
          safeNavigateToQuote(quote.id, { warning: 'link-appointment' });
          return;
        }
      }

      if (normalizedDate) {
        try {
          const [y = 0, m = 0, d = 0] = normalizedDate.split('-').map(Number);
          const scheduledDateObj = new Date(y, m - 1, d);
          if (!y || !m || !d || Number.isNaN(scheduledDateObj.getTime())) {
            toast.success('Trabajo creado. La fecha indicada no es válida para agendar.');
            safeNavigateToQuote(quote.id, { warning: 'schedule-invalid-date' });
            return;
          }
          await scheduleQuote.mutateAsync({
            quote_id: quote.id,
            title: `${values.client_name.trim()} - ${values.title.trim()}`,
            notes: values.notes?.trim() ? values.notes.trim() : null,
            scheduled_for: normalizedDate,
            starts_at: normalizedTime,
            ends_at: null,
            status: 'scheduled',
            store_id: null,
          });
          toast.success(
            `Trabajo creado y programado para ${formatDateAr(normalizedDate)}${normalizedTime ? ` - ${formatTimeShort(normalizedTime)}` : ''}.`,
          );
          safeNavigateToQuote(quote.id);
          return;
        } catch {
          safeNavigateToQuote(quote.id, { warning: 'schedule-appointment' });
          return;
        }
      }

      toast.success('Trabajo creado.');
      safeNavigateToQuote(quote.id);
    } catch (error) {
      if (quoteId) {
        await deleteQuoteById(quoteId).catch(() => {});
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['quotes'] }),
          queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        ]).catch(() => {});
        const cleanupMessage =
          error instanceof Error ? error.message : 'No se pudo guardar el trabajo.';
        onError(`${cleanupMessage} Se elimino el borrador parcial del trabajo.`);
        return;
      }
      onError(toUserErrorMessage(error, 'No se pudo guardar el trabajo.'));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    handleSubmit,
    isSaving: isSaving || linkAppointment.isPending || scheduleQuote.isPending,
  };
}
