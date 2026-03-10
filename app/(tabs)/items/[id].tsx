import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Snackbar } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { ItemForm } from '@/features/items/ItemForm';
import { useItems, useSaveItem } from '@/features/items/hooks';
import { toUserErrorMessage } from '@/lib/errors';

export default function ItemDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useItems();
  const save = useSaveItem();
  const [message, setMessage] = useState<string | null>(null);
  const item = data?.find((s) => s.id === id);

  return (
    <AppScreen title="Detalle de item">
      <LoadingOrError isLoading={isLoading} error={error} />
      {item && (
        <ItemForm
          defaultValues={{
            name: item.name,
            item_type: item.item_type,
            category: item.category ?? '',
            unit: item.unit ?? '',
            brand: item.brand ?? '',
            sku: item.sku ?? '',
            description: item.description ?? '',
            is_active: item.is_active,
          }}
          onSubmit={async (values) => {
            try {
              await save.mutateAsync({
                id: item.id,
                name: values.name,
                item_type: values.item_type,
                is_active: item.is_active,
                category: values.category?.trim() ? values.category.trim() : null,
                unit: values.unit?.trim() ? values.unit.trim() : null,
                brand: values.brand?.trim() ? values.brand.trim() : null,
                sku: values.sku?.trim() ? values.sku.trim() : null,
                description: values.description?.trim() ? values.description.trim() : null,
              });
              router.back();
            } catch (saveError) {
              setMessage(toUserErrorMessage(saveError, 'No se pudo guardar el item.'));
            }
          }}
        />
      )}
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}
