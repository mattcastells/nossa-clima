import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { ServiceForm } from '@/features/services/ServiceForm';
import { useSaveService, useServices } from '@/features/services/hooks';

export default function ServiceDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useServices();
  const save = useSaveService();
  const service = data?.find((s) => s.id === id);

  return (
    <AppScreen title="Detalle de servicio">
      <LoadingOrError isLoading={isLoading} error={error} />
      {service && (
        <ServiceForm
          defaultValues={service}
          onSubmit={async (values) => {
            await save.mutateAsync({ ...values, id: service.id });
            router.back();
          }}
        />
      )}
    </AppScreen>
  );
}
