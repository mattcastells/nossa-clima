import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import type { Store } from '@/types/db';

import { formatCurrencyArs, formatPercent } from '@/lib/format';

import { QuoteMaterialItemFormValues, quoteMaterialItemSchema } from '../schemas';
import { getEffectiveMaterialMarginPercent, getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from '../materialPricing';

interface Props {
  stores: Store[];
  defaultValues: QuoteMaterialItemFormValues;
  onSubmit: (values: QuoteMaterialItemFormValues) => Promise<void>;
  submitLabel: string;
  defaultMarginPercent?: number | null;
}

export const QuoteMaterialItemForm = ({ stores, defaultValues, onSubmit, submitLabel, defaultMarginPercent = null }: Props) => {
  const { control, handleSubmit, watch } = useForm<QuoteMaterialItemFormValues>({
    resolver: zodResolver(quoteMaterialItemSchema),
    defaultValues,
  });

  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');
  const marginPercent = watch('margin_percent');
  const effectiveMargin = getEffectiveMaterialMarginPercent(marginPercent, defaultMarginPercent);
  const effectiveUnitPrice = getMaterialEffectiveUnitPrice(unitPrice, marginPercent, defaultMarginPercent);
  const effectiveTotal = getMaterialEffectiveTotalPrice(quantity, unitPrice, marginPercent, defaultMarginPercent);
  const usesGlobalMargin = marginPercent == null && defaultMarginPercent != null;

  return (
    <View style={{ gap: 8 }}>
      <Controller
        control={control}
        name="quantity"
        render={({ field }) => (
          <TextInput mode="outlined" label="Cantidad" keyboardType="decimal-pad" value={String(field.value)} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="unit_price"
        render={({ field }) => (
          <TextInput mode="outlined" label="Costo unitario" keyboardType="decimal-pad" value={String(field.value)} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="margin_percent"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Margen % (vacío = global)"
            keyboardType="decimal-pad"
            value={field.value == null ? '' : String(field.value)}
            onChangeText={(value) => field.onChange(value ? Number(value) : null)}
          />
        )}
      />
      <Controller
        control={control}
        name="source_store_id"
        render={({ field }) => (
          <SegmentedButtons
            value={field.value ?? ''}
            onValueChange={(value) => field.onChange(value || null)}
            buttons={[
              { value: '', label: 'Sin tienda' },
              ...stores.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <TextInput mode="outlined" label="Notas" value={field.value ?? ''} onChangeText={field.onChange} />}
      />
      <Text>Margen efectivo: {formatPercent(effectiveMargin)}{usesGlobalMargin ? ' (global)' : ''}</Text>
      <Text>Venta unitaria estimada: {formatCurrencyArs(effectiveUnitPrice)}</Text>
      <Text>Total estimado: {formatCurrencyArs(effectiveTotal)}</Text>
      <Button mode="contained" onPress={handleSubmit(onSubmit)}>
        {submitLabel}
      </Button>
    </View>
  );
};
