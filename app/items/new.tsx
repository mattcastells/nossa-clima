import { router } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { ItemForm } from '@/features/items/ItemForm';
import { useSaveItem } from '@/features/items/hooks';

export default function NewItemPage() {
  const save = useSaveItem();

  return (
    <AppScreen title="Nuevo ítem">
      <ItemForm
        onSubmit={async (values) => {
          await save.mutateAsync(values);
          router.back();
        }}
      />
    </AppScreen>
  );
}
