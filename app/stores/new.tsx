import { router } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { StoreForm } from '@/features/stores/StoreForm';
import { useSaveStore } from '@/features/stores/hooks';

export default function NewStorePage() {
  const mutation = useSaveStore();
  return (
    <AppScreen title="Nueva tienda">
      <StoreForm
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
          router.back();
        }}
      />
    </AppScreen>
  );
}
