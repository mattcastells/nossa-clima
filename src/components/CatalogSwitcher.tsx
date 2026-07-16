import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { FONT_SANS_EXTRABOLD, FONT_SANS_SEMIBOLD, useAppTheme } from '@/theme';

export type CatalogSection = 'items' | 'services' | 'stores';

const SECTIONS: Array<{ key: CatalogSection; label: string; href: '/items' | '/services' | '/stores' }> = [
  { key: 'items', label: 'Materiales', href: '/items' },
  { key: 'services', label: 'Servicios', href: '/services' },
  { key: 'stores', label: 'Tiendas', href: '/stores' },
];

/**
 * Conmutador del catálogo (Materiales | Servicios | Tiendas). Las tres listas
 * son pantallas hermanas; esto las une en una sola sección navegable sin pasar
 * por la Home. Mismo patrón visual que las tabs del detalle de material.
 */
export const CatalogSwitcher = ({ active }: { active: CatalogSection }) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.tabs, { backgroundColor: theme.colors.surfaceVariant }]}>
      {SECTIONS.map((section) => {
        const isActive = section.key === active;
        return (
          <Pressable
            key={section.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => {
              if (!isActive) router.replace(section.href);
            }}
            style={[styles.tab, isActive && [styles.tabActive, { backgroundColor: theme.colors.surface }]]}
          >
            <Text
              style={[
                styles.tabText,
                { color: isActive ? theme.colors.primary : theme.colors.textMuted },
                isActive && styles.tabTextActive,
              ]}
            >
              {section.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
  },
  tabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: { fontSize: 13, fontFamily: FONT_SANS_SEMIBOLD },
  tabTextActive: { fontFamily: FONT_SANS_EXTRABOLD },
});
