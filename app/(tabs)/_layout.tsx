import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

type TabRouteName = 'index' | 'stores' | 'items' | 'services' | 'quotes' | 'settings';

const tabMeta: Record<TabRouteName, { title: string; shortLabel: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  index: { title: 'Inicio', shortLabel: 'Inicio', icon: 'home-outline' },
  stores: { title: 'Tiendas', shortLabel: 'Tiendas', icon: 'store-outline' },
  items: { title: 'Items', shortLabel: 'Items', icon: 'cube-outline' },
  services: { title: 'Servicios', shortLabel: 'Servicios', icon: 'briefcase-outline' },
  quotes: { title: 'Presupuestos', shortLabel: 'Presup.', icon: 'file-document-outline' },
  settings: { title: 'Ajustes', shortLabel: 'Ajustes', icon: 'cog-outline' },
};

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const compact = width < 420;

  return (
    <Tabs
      screenOptions={({ route }) => {
        const meta = tabMeta[route.name as TabRouteName];
        return {
          title: meta?.title ?? route.name,
          headerShown: false,
          tabBarShowLabel: !compact,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: '#0B6E4F',
          tabBarInactiveTintColor: '#6B7280',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarStyle: {
            height: compact ? 62 : 72,
            paddingTop: 6,
            paddingBottom: compact ? 8 : 10,
          },
          tabBarItemStyle: { paddingHorizontal: 2 },
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={meta?.icon ?? 'circle-outline'} color={color} size={compact ? size + 2 : size} />
          ),
          headerTitleStyle: { fontWeight: '600' },
          ...(compact ? {} : { tabBarLabel: meta?.shortLabel ?? route.name }),
        };
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="stores" />
      <Tabs.Screen name="items" />
      <Tabs.Screen name="prices" options={{ href: null }} />
      <Tabs.Screen name="services" />
      <Tabs.Screen name="quotes" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
