import { router } from 'expo-router';
import { useState } from 'react';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { ServiceForm } from '@/features/services/ServiceForm';
import { useSaveService, useServiceCategories } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';

export default function NewServicePage() {
  const save = useSaveService();
  const { data: categories } = useServiceCategories();
  const [message, setMessage] = useState<string | null>(null);
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));

  return (
    <AppScreen title="Nuevo servicio">
      <ServiceForm
        categorySuggestions={categories ?? []}
        onSubmit={async (values) => {
          try {
            await save.mutateAsync({
              name: values.name,
              base_price: values.base_price,
              description: values.description?.trim() ? values.description.trim() : null,
              category: values.category?.trim() ? values.category.trim() : null,
              unit_type: values.unit_type?.trim() ? values.unit_type.trim() : null,
            });
            toast.success('Servicio guardado.');
            router.back();
          } catch (error) {
            setMessage(toUserErrorMessage(error, 'No se pudo guardar el servicio.'));
          }
        }}
      />
    </AppScreen>
  );
}
