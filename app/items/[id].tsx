import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { ItemForm } from '@/features/items/ItemForm';
import { useItems, useSaveItem } from '@/features/items/hooks';

export default function ItemDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useItems();
  const save = useSaveItem();
  const item = data?.find((s) => s.id === id);

  return (
    <AppScreen title="Detalle de ítem">
      <LoadingOrError isLoading={isLoading} error={error} />
      {item && (
        <ItemForm
          defaultValues={item}
          onSubmit={async (values) => {
            await save.mutateAsync({ ...values, id: item.id });
            router.back();
          }}
        />
      )}
    </AppScreen>
  );
}
