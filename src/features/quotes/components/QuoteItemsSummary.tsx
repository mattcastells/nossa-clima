import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

import { formatCurrencyArs } from '@/lib/format';
import { useAppTheme } from '@/theme';

export interface SummaryRow {
  id: string;
  label: string;
  quantityLabel: string;
  unitPrice: number;
  totalPrice: number;
}

interface Props {
  title: string;
  rows: SummaryRow[];
  headerTint?: string;
  emptyText?: string;
  disabled?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function QuoteItemsSummary({
  title,
  rows,
  headerTint,
  emptyText = 'No hay items.',
  disabled = false,
  onEdit,
  onDelete,
}: Props) {
  const theme = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <View style={[styles.container, { borderColor: theme.colors.borderSoft }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: headerTint ?? theme.colors.surfaceAlt,
            borderBottomColor: theme.colors.borderSoft,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>{title}</Text>
        <IconButton
          icon={collapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          onPress={() => setCollapsed((c) => !c)}
          style={styles.collapseBtn}
          accessibilityLabel={collapsed ? 'Expandir' : 'Colapsar'}
        />
      </View>

      {!collapsed && (
        <View style={styles.body}>
          {rows.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{emptyText}</Text>
          ) : (
            rows.map((row) => (
              <View key={row.id} style={[styles.row, { borderBottomColor: theme.colors.borderSoft }]}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowLabel, { color: theme.colors.onSurface }]} numberOfLines={2}>
                    {row.label}
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.colors.textMuted }]}>
                    {row.quantityLabel} x {formatCurrencyArs(row.unitPrice)}
                  </Text>
                </View>
                <Text style={[styles.rowTotal, { color: theme.colors.primary }]}>
                  {formatCurrencyArs(row.totalPrice)}
                </Text>
                {onEdit ? (
                  <IconButton
                    icon="pencil-outline"
                    size={16}
                    disabled={disabled}
                    onPress={() => onEdit(row.id)}
                    style={styles.actionBtn}
                    accessibilityLabel="Editar"
                  />
                ) : null}
                {onDelete ? (
                  <IconButton
                    icon="trash-can-outline"
                    size={16}
                    disabled={disabled}
                    onPress={() => onDelete(row.id)}
                    style={styles.actionBtn}
                    accessibilityLabel="Eliminar"
                  />
                ) : null}
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  collapseBtn: {
    margin: 0,
  },
  body: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  rowMeta: {
    fontSize: 11,
  },
  rowTotal: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 70,
    textAlign: 'right',
  },
  actionBtn: {
    margin: 0,
  },
});