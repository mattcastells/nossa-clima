import { router } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { ServiceForm } from '@/features/services/ServiceForm';
import { useSaveService } from '@/features/services/hooks';

export default function NewServicePage() {
  const save = useSaveService();

  return (
    <AppScreen title="Nuevo servicio">
      <ServiceForm
        onSubmit={async (values) => {
          await save.mutateAsync(values);
          router.back();
        }}
      />
    </AppScreen>
  );
}
