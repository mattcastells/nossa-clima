import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="quotes" options={{ title: 'Trabajos' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendario' }} />
      <Tabs.Screen name="stores" options={{ title: 'Tiendas' }} />
      <Tabs.Screen name="items" options={{ title: 'Materiales' }} />
      <Tabs.Screen name="services" options={{ title: 'Servicios' }} />
      <Tabs.Screen name="assistant" options={{ title: 'Asistente AI' }} />
      <Tabs.Screen name="settings" options={{ title: 'Opciones' }} />
      <Tabs.Screen name="prices" options={{ href: null }} />
    </Tabs>
  );
}
