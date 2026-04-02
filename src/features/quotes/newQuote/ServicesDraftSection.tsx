import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Searchbar, Text, TextInput } from 'react-native-paper';

import { QuoteItemsSummary, type SummaryRow } from '@/features/quotes/components/QuoteItemsSummary';
import { formatCurrencyArs } from '@/lib/format';
import { useAppTheme } from '@/theme';
import { BRAND_BLUE, BRAND_BLUE_SOFT } from '@/theme';
import type { Service } from '@/types/db';

interface Props {
  // Search & selection
  serviceSearch: string;
  setServiceSearch: (v: string) => void;
  selectedService: Service | null;
  filteredServices: Service[];
  selectService: (service: Service) => void;
  clearSelectedService: () => void;
  // Inputs
  serviceQuantityInput: string;
  setServiceQuantityInput: (v: string) => void;
  serviceUnitPriceInput: string;
  setServiceUnitPriceInput: (v: string) => void;
  serviceNotesInput: string;
  setServiceNotesInput: (v: string) => void;
  // Draft list
  summaryRows: SummaryRow[];
  previewTotal: number;
  addDraftService: () => void;
  removeDraftService: (id: string) => void;
  // State
  disabled: boolean;
}

export function ServicesDraftSection({
  serviceSearch,
  setServiceSearch,
  selectedService,
  filteredServices,
  selectService,
  clearSelectedService,
  serviceQuantityInput,
  setServiceQuantityInput,
  serviceUnitPriceInput,
  setServiceUnitPriceInput,
  serviceNotesInput,
  setServiceNotesInput,
  summaryRows,
  previewTotal,
  addDraftService,
  removeDraftService,
  disabled,
}: Props) {
  const theme = useAppTheme();

  const handleDelete = useCallback(
    (id: string) => removeDraftService(id),
    [removeDraftService],
  );

  return (
    <Card mode="outlined" style={styles.sectionCard}>
      <Card.Content style={styles.sectionContent}>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">Servicios</Text>
          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
            Puedes agregar servicios antes de crear el trabajo.
          </Text>
        </View>

        <QuoteItemsSummary
          title={`Servicios del borrador (${summaryRows.length})`}
          rows={summaryRows}
          headerTint={theme.colors.softBlueStrong}
          emptyText="No agregaste servicios todavia."
          disabled={disabled}
          onDelete={handleDelete}
        />

        <Searchbar
          placeholder="Buscar servicio"
          value={serviceSearch}
          onChangeText={setServiceSearch}
          style={[
            styles.searchbar,
            {
              backgroundColor: theme.dark ? theme.colors.background : theme.colors.surface,
              borderColor: theme.colors.borderSoft,
            },
          ]}
          inputStyle={styles.searchbarInput}
        />

        {selectedService ? (
          <View style={[styles.selectedBanner, { backgroundColor: BRAND_BLUE_SOFT }]}>
            <Text style={[styles.selectedBannerText, { color: BRAND_BLUE }]} numberOfLines={1}>
              Servicio: {selectedService.name}
            </Text>
            <Button compact mode="text" onPress={clearSelectedService} disabled={disabled}>
              Quitar
            </Button>
          </View>
        ) : null}

        <View style={styles.resultsList}>
          {filteredServices.length > 0 ? (
            filteredServices.map((service) => {
              const selected = service.id === selectedService?.id;
              return (
                <Pressable
                  key={service.id}
                  onPress={() => selectService(service)}
                  style={[styles.resultRow, selected && styles.serviceResultRowSelected]}
                >
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultTitle}>{service.name}</Text>
                    <Text style={styles.resultMeta}>{service.category ?? 'Sin categoria'}</Text>
                  </View>
                  <Text style={styles.resultPrice}>{formatCurrencyArs(service.base_price)}</Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
              No hay servicios que coincidan con la busqueda.
            </Text>
          )}
        </View>

        <View style={styles.inlineFields}>
          <TextInput
            mode="outlined"
            label="Cantidad"
            value={serviceQuantityInput}
            onChangeText={setServiceQuantityInput}
            keyboardType="decimal-pad"
            outlineStyle={styles.inputOutline}
            style={styles.inlineField}
            disabled={disabled}
          />
          <TextInput
            mode="outlined"
            label="Precio unitario"
            value={serviceUnitPriceInput}
            onChangeText={setServiceUnitPriceInput}
            keyboardType="decimal-pad"
            outlineStyle={styles.inputOutline}
            style={styles.inlineField}
            disabled={disabled}
          />
        </View>
        <TextInput
          mode="outlined"
          label="Notas del servicio"
          value={serviceNotesInput}
          onChangeText={setServiceNotesInput}
          outlineStyle={styles.inputOutline}
          disabled={disabled}
        />
        <View style={styles.previewRow}>
          <Text style={[styles.previewLabel, { color: theme.colors.textMuted }]}>Total estimado</Text>
          <Text style={styles.previewValue}>{formatCurrencyArs(previewTotal)}</Text>
        </View>
        <Button mode="outlined" onPress={addDraftService} disabled={disabled}>
          Agregar servicio
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 12,
  },
  sectionContent: {
    gap: 12,
    paddingVertical: 10,
  },
  sectionHeader: {
    gap: 4,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  inputOutline: {
    borderRadius: 10,
  },
  searchbar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E1ED',
  },
  searchbarInput: {
    paddingLeft: 4,
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 8,
  },
  selectedBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  resultsList: {
    gap: 8,
  },
  resultRow: {
    borderWidth: 1,
    borderColor: '#D9E3EE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  serviceResultRowSelected: {
    borderColor: BRAND_BLUE,
    backgroundColor: BRAND_BLUE_SOFT,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  resultMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: '#5F6A76',
  },
  resultPrice: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  previewLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
});
