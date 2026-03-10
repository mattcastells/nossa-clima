import { Link } from 'expo-router';
import { FlatList, View } from 'react-native';
import { Button, Card, SegmentedButtons, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useQuotes } from '@/features/quotes/hooks';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';
import type { QuoteStatus } from '@/types/db';
import { useState } from 'react';

export default function QuotesScreen() {
  const [status, setStatus] = useState<QuoteStatus | 'all'>('all');
  const { data, isLoading, error } = useQuotes(status);

  return (
    <AppScreen title="Presupuestos">
      <SegmentedButtons
        value={status}
        onValueChange={(value) => setStatus(value as QuoteStatus | 'all')}
        buttons={[
          { value: 'all', label: 'Todos' },
          { value: 'draft', label: 'Borrador' },
          { value: 'sent', label: 'Enviado' },
          { value: 'approved', label: 'Aprobado' },
          { value: 'rejected', label: 'Rechazado' },
        ]}
      />
      <Link href="/quotes/new" asChild>
        <Button mode="contained">Nuevo presupuesto</Button>
      </Link>
      <LoadingOrError isLoading={isLoading} error={error} />
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/quotes/${item.id}`} asChild>
            <Card style={{ marginBottom: 8 }}>
              <Card.Content>
                <Text variant="titleMedium">{item.client_name}</Text>
                <Text>{item.title}</Text>
                <Text>{item.status.toUpperCase()} · {formatCurrencyArs(item.total)}</Text>
                <Text>{formatDateAr(item.created_at)}</Text>
              </Card.Content>
            </Card>
          </Link>
        )}
        ListEmptyComponent={
          <View>
            <Text>No hay presupuestos para este filtro. Creá uno nuevo para comenzar.</Text>
          </View>
        }
      />
    </AppScreen>
  );
}
