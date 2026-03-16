import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { StoreForm } from '@/features/stores/StoreForm';
import { useSaveStore } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';

const getSingleParam = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] ?? '' : value ?? '');

export default function NewStorePage() {
  const params = useLocalSearchParams<{ returnTo?: string | string[]; itemId?: string | string[] }>();
  const mutation = useSaveStore();
  const [message, setMessage] = useState<string | null>(null);
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));
  const returnTo = getSingleParam(params.returnTo).trim();
  const itemId = getSingleParam(params.itemId).trim();

  return (
    <AppScreen title="Nueva tienda">
      <StoreForm
        onSubmit={async (values) => {
          try {
            const store = await mutation.mutateAsync({
              name: values.name,
              description: values.description?.trim() ? values.description.trim() : null,
              address: values.address?.trim() ? values.address.trim() : null,
              phone: values.phone?.trim() ? values.phone.trim() : null,
              notes: values.notes?.trim() ? values.notes.trim() : null,
            });

            if (returnTo === '/prices/new') {
              toast.success('Tienda guardada.');
              router.replace({
                pathname: '/prices/new',
                params: {
                  itemId,
                  storeId: store.id,
                },
              });
              return;
            }

            toast.success('Tienda guardada.');
            router.back();
          } catch (error) {
            setMessage(toUserErrorMessage(error, 'No se pudo guardar la tienda.'));
          }
        }}
      />
    </AppScreen>
  );
}
