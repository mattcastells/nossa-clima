import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { BRAND_BLUE } from '@/theme';

type HomeAction = {
  title: string;
  subtitle: string;
  href: Href;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const HOME_ACTIONS: HomeAction[] = [
  { title: 'Trabajos', subtitle: 'Crear y gestionar trabajos', href: '/quotes', icon: 'briefcase-outline' },
  { title: 'Calendario', subtitle: 'Ver trabajos programados', href: '/(tabs)/calendar', icon: 'calendar-month-outline' },
  { title: 'Tiendas', subtitle: 'Gestionar proveedores', href: '/stores', icon: 'store-outline' },
  { title: 'Materiales', subtitle: 'Materiales y precios', href: '/items', icon: 'cube-outline' },
  { title: 'Servicios', subtitle: 'Mano de obra y tarifas', href: '/services', icon: 'wrench-outline' },
  { title: 'Asistente', subtitle: 'Consultas con texto e imagen', href: '/assistant', icon: 'robot-outline' },
  { title: 'Opciones', subtitle: 'Perfil y ajustes', href: '/settings', icon: 'cog-outline' },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <AppScreen showBackButton={false}>
      <View style={styles.bannerBand}>
        <Image source={require('../../assets/banner.png')} style={styles.banner} resizeMode="contain" />
      </View>
      <View style={styles.grid}>
        {HOME_ACTIONS.map((action) => (
          <Card key={action.title} mode="contained" style={styles.tile} onPress={() => router.push(action.href)}>
            <Card.Content style={styles.tileContent}>
              <MaterialCommunityIcons name={action.icon} size={34} color={BRAND_BLUE} />
              <Text variant="titleMedium" style={styles.tileTitle}>
                {action.title}
              </Text>
              <Text style={styles.tileSubtitle}>{action.subtitle}</Text>
            </Card.Content>
          </Card>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bannerBand: {
    marginHorizontal: -8,
    marginTop: -8,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F5F7',
    alignItems: 'center',
  },
  banner: {
    width: '94%',
    maxWidth: 560,
    height: 68,
    alignSelf: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE4EC',
    marginBottom: 12,
  },
  tileContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  tileTitle: {
    textAlign: 'center',
  },
  tileSubtitle: {
    textAlign: 'center',
    color: '#5f6368',
    lineHeight: 18,
  },
});
