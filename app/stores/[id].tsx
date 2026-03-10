import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { StoreForm } from '@/features/stores/StoreForm';
import { useSaveStore, useStores } from '@/features/stores/hooks';

export default function StoreDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useStores();
  const save = useSaveStore();
  const store = data?.find((s) => s.id === id);

  return (
    <AppScreen title="Detalle de tienda">
      <LoadingOrError isLoading={isLoading} error={error} />
      {store && (
        <StoreForm
          defaultValues={store}
          onSubmit={async (values) => {
            await save.mutateAsync({ ...values, id: store.id });
            router.back();
          }}
        />
      )}
    </AppScreen>
  );
}
