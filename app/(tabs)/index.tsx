import { Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useDashboardSummary } from '@/features/dashboard/hooks';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';

export default function DashboardScreen() {
  const { data, isLoading, error } = useDashboardSummary();

  return (
    <AppScreen title="Dashboard">
      <LoadingOrError isLoading={isLoading} error={error} />
      {data && (
        <>
          <Card>
            <Card.Title title="Tiendas activas" subtitle={String(data.totalStores)} />
          </Card>
          <Card>
            <Card.Title title="Ítems activos" subtitle={String(data.totalItems)} />
          </Card>
          {data.latestPrices.map((price) => (
            <Card key={price.id}>
              <Card.Title
                title={`${price.item_name} - ${price.store_name}`}
                subtitle={`${formatCurrencyArs(price.price)} (${formatDateAr(price.observed_at)})`}
              />
            </Card>
          ))}
          {data.latestPrices.length === 0 && <Text>No hay precios cargados aún. Registrá uno para iniciar el historial.</Text>}
        </>
      )}
    </AppScreen>
  );
}
