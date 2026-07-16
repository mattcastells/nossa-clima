import { useRouter, useSegments, type Href } from 'expo-router';
import { PropsWithChildren, ReactNode } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, Text } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, useAppTheme } from '@/theme';

interface Props extends PropsWithChildren {
  title?: string;
  titleRight?: ReactNode;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  scrollable?: boolean;
  /** Contenido fijo dentro del encabezado blanco: buscador, chips de filtro, selector de fecha. */
  headerContent?: ReactNode;
  /** Texto del volver. El diseño usa el nombre de la sección padre ("Trabajos"), no "Volver". */
  backLabel?: string;
  /** Reemplaza el título por contenido propio dentro del encabezado (p. ej. el logo del inicio). */
  headerLeading?: ReactNode;
}

type TabDef = { key: string; icon: string; label: string; href: Href; matches?: string[] };

const TABS: TabDef[] = [
  { key: 'index', icon: 'home-variant-outline', label: 'Inicio', href: '/(tabs)' },
  { key: 'quotes', icon: 'briefcase-outline', label: 'Trabajos', href: '/(tabs)/quotes' },
  { key: 'calendar', icon: 'calendar-month-outline', label: 'Agenda', href: '/(tabs)/calendar' },
  // El catálogo agrupa las tres listas hermanas; ver CatalogSwitcher.
  { key: 'items', icon: 'cube-outline', label: 'Catálogo', href: '/(tabs)/items', matches: ['items', 'services', 'stores'] },
  { key: 'assistant', icon: 'robot-outline', label: 'Asistente', href: '/(tabs)/assistant' },
];

export const AppScreen = ({
  title,
  titleRight,
  children,
  showBackButton = true,
  scrollable = true,
  headerContent,
  backLabel = 'Volver',
  headerLeading,
}: Props) => {
  const router = useRouter();
  const segments = useSegments();
  const theme = useAppTheme();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const inTabs = segments[0] === '(tabs)';
  const inAuth = segments[0] === '(auth)';
  const nestedInTabs = inTabs && segments.length > 2;
  const outsideTabsAndAuth = !inTabs && !inAuth && segments.length > 0;
  const activeSection = inTabs ? (segments[1] ?? 'index') : null;
  const showTabBar = width < 768 && !inAuth && (inTabs || outsideTabsAndAuth);
  const showBack = showBackButton && (nestedInTabs || outsideTabsAndAuth);
  const fallback: Href = inTabs && segments[1] ? (`/(tabs)/${segments[1]}` as Href) : '/(tabs)';

  const hasHeader = Boolean(showBack || title || headerLeading || titleRight || headerContent);

  const header = hasHeader ? (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.borderSoft }]}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
          hitSlop={6}
        >
          <Icon source="arrow-left" size={20} color={theme.colors.accentStrong} />
          <Text style={[styles.backLabel, { color: theme.colors.accentStrong }]}>{backLabel}</Text>
        </Pressable>
      ) : null}
      {headerLeading ?? null}
      {title || titleRight ? (
        <View style={styles.titleRow}>
          {title ? (
            <Text style={[styles.title, { color: theme.colors.titleOnSoft }, titleRight ? styles.titleFlex : undefined]} numberOfLines={2}>
              {title}
            </Text>
          ) : (
            <View style={styles.titleFlex} />
          )}
          {titleRight ? <View style={styles.titleRightContainer}>{titleRight}</View> : null}
        </View>
      ) : null}
      {headerContent ?? null}
    </View>
  ) : null;

  const innerContent = (
    <AnimatedEntrance active={isFocused} delay={20} distance={16} style={scrollable ? styles.container : [styles.container, styles.flexContainer]}>
      <View style={[styles.content, !scrollable && styles.flexContent]}>{children}</View>
    </AnimatedEntrance>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.screenShell}>
        {header}
        {scrollable ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              showTabBar && styles.scrollContentWithBottomNav,
              { backgroundColor: theme.colors.background },
            ]}
          >
            {innerContent}
          </ScrollView>
        ) : (
          <View style={[styles.fixedWrapper, { backgroundColor: theme.colors.background }]}>{innerContent}</View>
        )}

        {showTabBar ? (
          <View style={[styles.bottomNav, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.borderSoft }]}>
            {TABS.map((tab) => (
              <NavButton
                key={tab.key}
                icon={tab.icon}
                label={tab.label}
                active={activeSection != null && (tab.matches ?? [tab.key]).includes(activeSection)}
                onPress={() => router.replace(tab.href)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const NavButton = ({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) => {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.bottomNavButton, pressed && styles.bottomNavButtonPressed]}
    >
      <View style={[styles.bottomNavIcon, active && { backgroundColor: theme.colors.accentSoft }]}>
        <Icon source={icon} size={22} color={active ? theme.colors.accentStrong : theme.colors.textMuted} />
      </View>
      <Text style={[styles.bottomNavLabel, { color: active ? theme.colors.accentStrong : theme.colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screenShell: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  backLabel: { fontSize: 14, fontFamily: FONT_SANS_BOLD },
  pressed: { opacity: 0.7 },
  scrollContent: { flexGrow: 1 },
  // La tab bar es parte del layout, no flota sobre el scroll: no hace falta
  // reservarle alto acá. Solo un respiro para que la ultima tarjeta no la toque.
  scrollContentWithBottomNav: { paddingBottom: 8 },
  fixedWrapper: { flex: 1 },
  container: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
  flexContainer: { flex: 1, paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  titleFlex: { flex: 1 },
  titleRightContainer: { marginLeft: 8 },
  title: { fontSize: 26, lineHeight: 32, fontFamily: FONT_SANS_EXTRABOLD },
  content: { gap: 16 },
  flexContent: { flex: 1, minHeight: 0 },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  bottomNavButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bottomNavButtonPressed: {
    opacity: 0.7,
  },
  bottomNavIcon: {
    width: 46,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT_SANS_BOLD,
  },
});
