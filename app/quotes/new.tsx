import { router } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { QuoteForm } from '@/features/quotes/QuoteForm';
import { useSaveQuote } from '@/features/quotes/hooks';

export default function NewQuotePage() {
  const save = useSaveQuote();

  return (
    <AppScreen title="Nuevo presupuesto">
      <QuoteForm
        defaultValues={{ status: 'draft' }}
        onSubmit={async (values) => {
          const quote = await save.mutateAsync(values);
          router.replace(`/quotes/${quote.id}`);
        }}
      />
    </AppScreen>
  );
}
