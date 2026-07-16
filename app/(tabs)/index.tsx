import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, useAppTheme } from '@/theme';

type HomeAction = {
  title: string;
  href: Href;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  soft: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const homeBannerSource = theme.dark ? require('../../assets/nc-logo-dark.png') : require('../../assets/nc-logo-light.png');

  const actions: HomeAction[] = [
    { title: 'Materiales', href: '/items', icon: 'cube-outline', tint: theme.colors.accentStrong, soft: theme.colors.accentSoft },
    { title: 'Tiendas', href: '/stores', icon: 'store-outline', tint: theme.colors.primary, soft: theme.colors.softBlue },
    { title: 'Servicios', href: '/services', icon: 'wrench-outline', tint: theme.colors.onSoftYellow, soft: theme.colors.softYellow },
    { title: 'Nuevo turno', href: '/calendar?nuevo=1', icon: 'calendar-plus', tint: theme.colors.toastSuccessText, soft: theme.colors.softGreen },
    { title: 'Manuales', href: '/documents', icon: 'file-pdf-box', tint: theme.colors.primary, soft: theme.colors.softBlue },
    { title: 'Opciones', href: '/settings', icon: 'cog-outline', tint: theme.colors.textMuted, soft: theme.colors.surfaceVariant },
  ];

  return (
    <AppScreen
      showBackButton={false}
      headerLeading={
        <View style={styles.bannerBand}>
          <Image source={homeBannerSource} style={styles.bannerImage} resizeMode="contain" />
        </View>
      }
    >
      <AnimatedEntrance delay={70} distance={12}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nuevo trabajo"
          onPress={() => router.push('/quotes/new')}
          style={({ pressed }) => [styles.cta, { backgroundColor: theme.colors.accent }, pressed && styles.pressed]}
        >
          <View style={[styles.ctaIcon, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <MaterialCommunityIcons name="plus" size={26} color={theme.colors.onAccent} />
          </View>
          <Text style={[styles.ctaText, { color: theme.colors.onAccent }]}>Nuevo trabajo</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.onAccent} />
        </Pressable>
      </AnimatedEntrance>

      <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>ACCESOS</Text>

      <View style={styles.grid}>
        {actions.map((action, index) => (
          <AnimatedEntrance key={action.title} delay={110 + index * 40} distance={14} style={styles.tileShell}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(action.href)}
              style={({ pressed }) => [styles.tilePressable, pressed && styles.pressed]}
            >
              <View style={[styles.tile, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}>
                <View style={[styles.iconBubble, { backgroundColor: action.soft }]}>
                  <MaterialCommunityIcons name={action.icon} size={26} color={action.tint} />
                </View>
                <Text style={[styles.tileTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={1}>
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
    alignItems: 'flex-start',
  },
  bannerImage: {
    width: 210,
    height: 46,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 22,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    flex: 1,
    fontSize: 18,
    fontFamily: FONT_SANS_EXTRABOLD,
  },
  pressed: { opacity: 0.85 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileShell: {
    width: '31.5%',
    marginBottom: 12,
  },
  tilePressable: {
    width: '100%',
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: FONT_SANS_BOLD,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: FONT_SANS_BOLD,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: -8,
  },
});
