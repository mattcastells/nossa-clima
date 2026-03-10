import { Link, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { QuoteForm } from '@/features/quotes/QuoteForm';
import { useQuoteDetail, useSaveQuote } from '@/features/quotes/hooks';

export default function QuoteDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useQuoteDetail(id);
  const save = useSaveQuote();

  return (
    <AppScreen title="Detalle de presupuesto">
      <LoadingOrError isLoading={isLoading} error={error} />
      {data && (
        <View style={{ gap: 12 }}>
          <QuoteForm
            defaultValues={data.quote}
            buttonLabel="Guardar cabecera"
            onSubmit={async (values) => {
              await save.mutateAsync({ ...values, id: data.quote.id });
            }}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Link href={`/quotes/${data.quote.id}/add-material`} asChild>
              <Button mode="contained-tonal">Agregar material</Button>
            </Link>
            <Link href={`/quotes/${data.quote.id}/add-service`} asChild>
              <Button mode="contained-tonal">Agregar servicio</Button>
            </Link>
          </View>

          <Card>
            <Card.Title title="Materiales" />
            <Card.Content style={{ gap: 6 }}>
              {data.materials.map((m) => (
                <View key={m.id}>
                  <Text>{m.item_name_snapshot}</Text>
                  <Text>
                    {m.quantity} x ${m.unit_price} = ${m.total_price}
                  </Text>
                </View>
              ))}
              {data.materials.length === 0 && <Text>Sin materiales cargados.</Text>}
            </Card.Content>
          </Card>

          <Card>
            <Card.Title title="Mano de obra" />
            <Card.Content style={{ gap: 6 }}>
              {data.services.map((s) => (
                <View key={s.id}>
                  <Text>{s.service_name_snapshot}</Text>
                  <Text>
                    {s.quantity} x ${s.unit_price} = ${s.total_price}
                  </Text>
                </View>
              ))}
              {data.services.length === 0 && <Text>Sin servicios cargados.</Text>}
            </Card.Content>
          </Card>

          <Divider />
          <Card>
            <Card.Content style={{ gap: 4 }}>
              <Text variant="titleMedium">Subtotal materiales: ${data.quote.subtotal_materials}</Text>
              <Text variant="titleMedium">Subtotal mano de obra: ${data.quote.subtotal_services}</Text>
              <Text variant="headlineSmall">TOTAL: ${data.quote.total}</Text>
            </Card.Content>
          </Card>
        </View>
      )}
    </AppScreen>
  );
}
