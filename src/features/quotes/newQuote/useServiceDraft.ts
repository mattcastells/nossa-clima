import { useCallback, useMemo, useState } from 'react';

import type { SummaryRow } from '@/features/quotes/components/QuoteItemsSummary';
import type { Service } from '@/types/db';

import { parseNonNegativeInput, parsePositiveInput } from './parseInput';
import { createDraftId, type DraftServiceLine } from './types';

interface UseServiceDraftOptions {
  services: Service[] | undefined;
  onError: (msg: string) => void;
}

export function useServiceDraft({ services, onError }: UseServiceDraftOptions) {
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceQuantityInput, setServiceQuantityInput] = useState('1');
  const [serviceUnitPriceInput, setServiceUnitPriceInput] = useState('');
  const [serviceNotesInput, setServiceNotesInput] = useState('');
  const [draftServices, setDraftServices] = useState<DraftServiceLine[]>([]);

  const selectedService = useMemo(
    () => (services ?? []).find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    return (services ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(
        (s) =>
          !query ||
          s.name.toLowerCase().includes(query) ||
          (s.category ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [serviceSearch, services]);

  const previewTotal = useMemo(() => {
    const quantity = parsePositiveInput(serviceQuantityInput) ?? 0;
    const unitPrice = parseNonNegativeInput(serviceUnitPriceInput) ?? 0;
    return Number((quantity * unitPrice).toFixed(2));
  }, [serviceQuantityInput, serviceUnitPriceInput]);

  const summaryRows: SummaryRow[] = useMemo(
    () =>
      draftServices.map((s) => ({
        id: s.id,
        label: s.label,
        quantityLabel: String(s.quantity),
        unitPrice: s.unit_price,
        totalPrice: s.total_price,
      })),
    [draftServices],
  );

  const resetInputs = useCallback(() => {
    setSelectedServiceId('');
    setServiceSearch('');
    setServiceQuantityInput('1');
    setServiceUnitPriceInput('');
    setServiceNotesInput('');
  }, []);

  const selectService = useCallback((service: Service) => {
    setSelectedServiceId(service.id);
    setServiceUnitPriceInput(String(service.base_price));
  }, []);

  const clearSelectedService = useCallback(() => setSelectedServiceId(''), []);

  const addDraftService = useCallback(() => {
    const quantity = parsePositiveInput(serviceQuantityInput);
    if (!selectedService || quantity == null) {
      onError('Selecciona un servicio y una cantidad valida.');
      return;
    }
    const unitPrice = parseNonNegativeInput(serviceUnitPriceInput);
    if (unitPrice == null) {
      onError('Ingresa un precio valido para el servicio.');
      return;
    }
    setDraftServices((current) => [
      ...current,
      {
        id: createDraftId(),
        service_id: selectedService.id,
        label: selectedService.name,
        quantity,
        unit_price: unitPrice,
        notes: serviceNotesInput.trim() || null,
        total_price: Number((quantity * unitPrice).toFixed(2)),
      },
    ]);
    resetInputs();
  }, [selectedService, serviceQuantityInput, serviceUnitPriceInput, serviceNotesInput, onError, resetInputs]);

  const removeDraftService = useCallback(
    (id: string) => setDraftServices((current) => current.filter((s) => s.id !== id)),
    [],
  );

  return {
    serviceSearch,
    setServiceSearch,
    selectedService,
    serviceQuantityInput,
    setServiceQuantityInput,
    serviceUnitPriceInput,
    setServiceUnitPriceInput,
    serviceNotesInput,
    setServiceNotesInput,
    draftServices,
    filteredServices,
    previewTotal,
    summaryRows,
    selectService,
    clearSelectedService,
    addDraftService,
    removeDraftService,
  };
}
