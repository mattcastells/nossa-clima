import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { useAppTheme } from '@/theme';

type HomeAction = {
  title: string;
  href: Href;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const HOME_ACTIONS: HomeAction[] = [
  { title: 'Trabajos', href: '/quotes', icon: 'briefcase-outline' },
  { title: 'Calendario', href: '/(tabs)/calendar', icon: 'calendar-month-outline' },
  { title: 'Tiendas', href: '/stores', icon: 'store-outline' },
  { title: 'Materiales', href: '/items', icon: 'cube-outline' },
  { title: 'Servicios', href: '/services', icon: 'wrench-outline' },
  { title: 'Manuales', href: '/documents', icon: 'file-pdf-box' },
  { title: 'Asistente', href: '/assistant', icon: 'robot-outline' },
  { title: 'Opciones', href: '/settings', icon: 'cog-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const homeBannerSource = theme.dark ? require('../../assets/nc-logo-dark.png') : require('../../assets/nc-logo-light.png');

  return (
    <AppScreen showBackButton={false}>
      <AnimatedEntrance delay={40} distance={10}>
        <View style={[styles.bannerBand, { backgroundColor: theme.colors.background }]}>
          <View style={styles.bannerFrame}>
            <Image source={homeBannerSource} style={styles.bannerImage} resizeMode="contain" />
          </View>
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
                <Text style={[styles.tileTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={2}>
                  {action.title}
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
    marginBottom: 4,
    paddingTop: 8,
    paddingBottom: 2,
    paddingHorizontal: 12,
    backgroundColor: '#F3F5F7',
    alignItems: 'center',
  },
  bannerFrame: {
    width: '100%',
    maxWidth: 640,
    aspectRatio: 2000 / 435,
    alignSelf: 'center',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
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
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
