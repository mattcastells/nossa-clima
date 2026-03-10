import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="stores" options={{ title: 'Tiendas' }} />
      <Tabs.Screen name="items" options={{ title: 'Ítems' }} />
      <Tabs.Screen name="prices" options={{ title: 'Precios' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
