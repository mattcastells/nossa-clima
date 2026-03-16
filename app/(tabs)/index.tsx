import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { useAppTheme } from '@/theme';

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
  const theme = useAppTheme();

  return (
    <AppScreen showBackButton={false}>
      <AnimatedEntrance delay={40} distance={10}>
        <View style={[styles.bannerBand, { backgroundColor: theme.colors.background }]}>
          <Image source={require('../../assets/banner.png')} style={styles.banner} resizeMode="contain" />
        </View>
      </AnimatedEntrance>
      <View style={styles.grid}>
        {HOME_ACTIONS.map((action, index) => (
          <AnimatedEntrance key={action.title} delay={90 + index * 45} distance={14} style={styles.tileShell}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(action.href)}
              style={({ pressed }) => [styles.tilePressable, pressed && styles.tilePressed]}
            >
              <View style={[styles.tile, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}>
                <View style={[styles.iconBubble, { backgroundColor: theme.colors.softBlue }]}>
                  <MaterialCommunityIcons name={action.icon} size={30} color={theme.colors.primary} />
                </View>
                <Text style={[styles.tileTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={1}>
                  {action.title}
                </Text>
                <Text style={[styles.tileSubtitle, { color: theme.colors.textMuted }]} numberOfLines={2}>
                  {action.subtitle}
                </Text>
              </View>
            </Pressable>
          </AnimatedEntrance>
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
  tileShell: {
    width: '48%',
    marginBottom: 12,
  },
  tilePressable: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
  },
  tilePressed: {
    opacity: 0.82,
  },
  tile: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  tileSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
